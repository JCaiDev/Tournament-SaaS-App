import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TeamService } from '../../../services/team.service';
import { CourtMode, GenerateScheduleRequest, Match, Team } from '../../../models/team';
import { DatetimePicker } from '../../../shared/datetime-picker/datetime-picker';
import {
  countRefGaps,
  formatDuration,
  courtCells,
  groupByTime,
  inferSlotMinutes,
  looksOnePoolPerCourt,
  maxRefCourts,
  minimumSlots,
  onePoolPerCourtSlots,
  refDutyRange,
  roundRobinCount,
  scheduleEnd,
  toLocalInput,
} from '../../../shared/schedule/schedule-view';

// Same limits as the API's generateScheduleSchema.
const COURTS_MIN = 1;
const COURTS_MAX = 500;
const SLOT_MIN = 20;
const SLOT_MAX = 240;
const DEFAULT_SLOT = 45;
const SLOT_PRESETS = [25, 35, 45, 55];
// Pool colours cycle after this many (see .pool-c0 … .pool-c7 in the CSS).
const POOL_COLOURS = 8;

export interface SchedulePool {
  name: string;
  teams: Team[];
}

type StaleReason = 'pools' | 'teams';
// When there are fewer courts than pools, how the pools share them.
export type PoolOrder = 'TAKE_TURNS' | 'WAVES';

// Step 3 of the organizer's draft: pick courts, start time and slot length,
// then POST /schedule. The API pairs every team in each pool (round robin),
// packs the matches onto courts and time slots, and returns the saved list.
//
// The schedule is built from the *saved* pools, and saving pools (or deleting
// a team) deletes the draft schedule on the server. So this component:
// - waits for any pending pools autosave before generating (`beforeGenerate`);
// - hides a schedule the server has already thrown away (`staleReason`).
@Component({
  selector: 'app-tournament-schedule',
  imports: [ReactiveFormsModule, DatetimePicker],
  templateUrl: './tournament-schedule.html',
  styleUrl: './tournament-schedule.css',
})
export class TournamentSchedule implements OnInit {
  private readonly teamService = inject(TeamService);

  readonly lobbyId = input.required<string>();
  readonly teams = input.required<Team[]>();
  // The pools on screen, in display order (Pool A, B, …).
  readonly pools = input.required<SchedulePool[]>();
  readonly unassignedCount = input.required<number>();
  // SerialSaver.savedCount of the pools autosave: when it goes up, the server
  // just deleted the draft schedule.
  readonly poolsSavedCount = input.required<number>();
  // Resolves once every pools change is on the server (false = save failed).
  readonly beforeGenerate = input.required<() => Promise<boolean>>();
  readonly lobbyStart = input<string | null>(null);
  readonly lobbyEnd = input<string | null>(null);

  readonly loading = signal(true);
  readonly generating = signal(false);
  readonly error = signal<string | null>(null);

  // The schedule as the server last returned it, and the pools save count at
  // that moment (to tell whether a later pools save wiped it).
  private readonly matches = signal<Match[]>([]);
  private readonly matchesAtSave = signal(0);
  // Slot length the shown schedule was generated with.
  private readonly slotUsed = signal(DEFAULT_SLOT);
  // Whether the shown schedule was generated with refs / one court per pool.
  // The API doesn't store these settings, so on reload they're read back
  // from the matches (any refTeamId → refs were on).
  private readonly refsUsed = signal(false);
  private readonly onePoolPerCourtUsed = signal(false);

  readonly highlightTeamId = signal<string | null>(null);

  readonly slotPresets = SLOT_PRESETS;
  readonly limits = { COURTS_MIN, COURTS_MAX, SLOT_MIN, SLOT_MAX };
  readonly form = new FormGroup({
    courts: new FormControl(2, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(COURTS_MIN), Validators.max(COURTS_MAX)],
    }),
    // Local "YYYY-MM-DDTHH:mm" from the picker; blank = the lobby's start time.
    startTime: new FormControl('', { nonNullable: true }),
    slotMinutes: new FormControl(DEFAULT_SLOT, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(SLOT_MIN), Validators.max(SLOT_MAX)],
    }),
  });
  // Form values as signals, so the estimate below updates while typing.
  readonly courts = signal(2);
  private readonly slotMinutes = signal(DEFAULT_SLOT);
  // The "First match" field as a signal, so the hint below it can react.
  private readonly startValue = signal('');

  // ---- Court sharing and refs (plain signals: they depend on each other) ----

  // What the organizer ticked. Only takes effect while courts === pools.
  readonly onePoolPerCourtChoice = signal(false);
  // Only asked when there are fewer courts than pools.
  readonly poolOrder = signal<PoolOrder>('TAKE_TURNS');
  // On by default: most organizers have the sitting team ref. Sent
  // explicitly; the API's own default is off (for older clients).
  readonly referees = signal(true);

  readonly poolCount = computed(() => this.pools().length);
  readonly teamCount = computed(() => this.pools().reduce((sum, p) => sum + p.teams.length, 0));
  readonly onePoolPerCourtAvailable = computed(
    () => this.poolCount() > 1 && this.courts() === this.poolCount(),
  );
  readonly onePoolPerCourt = computed(
    () => this.onePoolPerCourtChoice() && this.onePoolPerCourtAvailable(),
  );
  readonly showPoolOrder = computed(
    () => !this.onePoolPerCourt() && this.poolCount() > 1 && this.courts() < this.poolCount(),
  );
  readonly courtMode = computed<CourtMode>(() => {
    if (this.onePoolPerCourt()) return 'ONE_POOL_PER_COURT';
    // With courts ≥ pools the two orders barely differ; take turns keeps
    // every pool moving, so it's the quiet default.
    return this.showPoolOrder() ? this.poolOrder() : 'TAKE_TURNS';
  });

  // Before generating: will some matches have nobody free to ref?
  readonly refWarning = computed<{ text: string; useCourts: number | null } | null>(() => {
    if (!this.referees() || this.blockers().length > 0) return null;
    if (this.onePoolPerCourt()) {
      const small = this.pools().filter((p) => p.teams.length < 3);
      if (small.length === 0) return null;
      const names = small.map((p) => p.name).join(', ');
      return {
        text: `${names} ${small.length === 1 ? 'has' : 'have'} only 2 teams, so nobody in the pool is free to ref. Organizers will ref those matches.`,
        useCourts: null,
      };
    }
    const max = maxRefCourts(this.teamCount());
    if (this.courts() <= max) return null;
    return {
      text:
        max === 0
          ? `With ${this.teamCount()} teams, nobody is ever free to ref. Organizers will ref every match.`
          : `With ${this.teamCount()} teams, at most ${max} ${max === 1 ? 'match' : 'matches'} at a time can have a team ref. Some matches may need an organizer to ref.`,
      useCourts: max >= 1 ? max : null,
    };
  });

  // ---- Lookups ----

  private readonly teamName = computed(() => new Map(this.teams().map((t) => [t.id, t.name])));
  // team id → index of its pool on screen (drives the name and colour).
  private readonly poolIndexOfTeam = computed(() => {
    const map = new Map<string, number>();
    this.pools().forEach((pool, i) => pool.teams.forEach((t) => map.set(t.id, i)));
    return map;
  });

  // ---- Can we generate? Mirrors the API's 409 checks, to explain *before* clicking. ----

  readonly blockers = computed<string[]>(() => {
    const pools = this.pools();
    if (pools.length === 0) return ['Make pools first (step 2).'];
    const reasons: string[] = [];
    const unassigned = this.unassignedCount();
    if (unassigned > 0) {
      reasons.push(`${unassigned} ${unassigned === 1 ? 'team isn’t' : 'teams aren’t'} in a pool yet.`);
    }
    for (const pool of pools) {
      if (pool.teams.length < 2) reasons.push(`${pool.name} needs at least 2 teams.`);
    }
    return reasons;
  });

  // "12 matches · at least 6 slots · about 4h 30m" before generating.
  readonly estimate = computed(() => {
    const sizes = this.pools().map((p) => p.teams.length);
    const matchCount = sizes.reduce((sum, n) => sum + roundRobinCount(n), 0);
    const courts = this.courts();
    const slot = this.slotMinutes();
    if (matchCount === 0 || !(courts >= COURTS_MIN) || !(slot >= SLOT_MIN)) return null;
    const slots = this.onePoolPerCourt() ? onePoolPerCourtSlots(sizes) : minimumSlots(sizes, courts);
    return { matchCount, slots, duration: formatDuration(slots * slot) };
  });

  // ---- The schedule on screen ----

  // Why the last schedule is no longer on the server (null = it still is).
  readonly staleReason = computed<StaleReason | null>(() => {
    const matches = this.matches();
    if (matches.length === 0) return null;
    if (this.poolsSavedCount() !== this.matchesAtSave()) return 'pools';
    const names = this.teamName();
    if (matches.some((m) => !names.has(m.teamAId) || !names.has(m.teamBId))) return 'teams';
    return null;
  });

  private readonly liveMatches = computed(() => (this.staleReason() ? [] : this.matches()));

  // The saved schedule starts at a different time than the form shows (the
  // organizer chose a later first match last time): offer it back in one click.
  readonly savedStartHint = computed(() => {
    const matches = this.liveMatches();
    if (matches.length === 0) return null;
    const first = matches.reduce((a, b) => (a.startTime < b.startTime ? a : b)).startTime;
    const value = toLocalInput(first);
    const current = this.startValue();
    if (value === current) return null;
    // Same day as the form: the time is enough. Another day: say which.
    const sameDay = current.slice(0, 10) === value.slice(0, 10);
    const label = sameDay ? formatTime(first) : `${formatDay(new Date(first))}, ${formatTime(first)}`;
    return { value, label };
  });

  useSavedStart(): void {
    const hint = this.savedStartHint();
    if (hint) this.form.controls.startTime.setValue(hint.value);
  }
  readonly hasSchedule = computed(() => this.liveMatches().length > 0);

  // Court × time grid: one column per court, one row per start time.
  readonly courtNumbers = computed(() => {
    const matches = this.liveMatches();
    const count = matches.length ? Math.max(...matches.map((m) => m.court)) : 0;
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  readonly slots = computed(() => {
    const courtCount = this.courtNumbers().length;
    return groupByTime(this.liveMatches()).map((slot, i) => ({
      key: slot.startTime,
      round: i + 1,
      time: formatTime(slot.startTime),
      cells: courtCells(slot.matches, courtCount).map((m) => (m ? this.toCard(m) : null)),
    }));
  });

  readonly summary = computed(() => {
    const matches = this.liveMatches();
    if (matches.length === 0) return null;
    const slot = this.slotUsed();
    const start = new Date(Math.min(...matches.map((m) => new Date(m.startTime).getTime())));
    const end = scheduleEnd(matches, slot)!;
    const lobbyEnd = this.lobbyEnd() ? new Date(this.lobbyEnd()!) : null;
    const overrun = lobbyEnd ? Math.round((end.getTime() - lobbyEnd.getTime()) / 60_000) : 0;
    const teamIds = [...new Set(matches.flatMap((m) => [m.teamAId, m.teamBId]))];
    const duties = this.refsUsed() ? refDutyRange(matches, teamIds) : null;
    return {
      refDuty: duties ? (duties.min === duties.max ? `${duties.min}` : `${duties.min}–${duties.max}`) : null,
      matchCount: matches.length,
      courtCount: Math.max(...matches.map((m) => m.court)),
      day: formatDay(start),
      start: formatTime(start),
      end: formatTime(end),
      length: formatDuration((end.getTime() - start.getTime()) / 60_000),
      slot,
      overrun: overrun > 0 ? { by: formatDuration(overrun), lobbyEnd: formatTime(lobbyEnd!) } : null,
    };
  });

  // After generating with refs on: matches nobody was free to ref.
  readonly refGaps = computed<{ count: number; useCourts: number | null } | null>(() => {
    if (!this.refsUsed()) return null;
    const matches = this.liveMatches();
    const count = countRefGaps(matches);
    if (count === 0) return null;
    // Fewer courts fixes it unless each pool is pinned to its court.
    const teams = new Set(matches.flatMap((m) => [m.teamAId, m.teamBId])).size;
    const max = maxRefCourts(teams);
    const courtsNow = Math.max(...matches.map((m) => m.court));
    const useCourts = !this.onePoolPerCourtUsed() && max >= 1 && max < courtsNow ? max : null;
    return { count, useCourts };
  });

  // Teams in the schedule, A–Z, for the "Highlight a team" menu.
  readonly scheduledTeams = computed(() => {
    const names = this.teamName();
    const ids = new Set(this.liveMatches().flatMap((m) => [m.teamAId, m.teamBId]));
    return [...ids]
      .map((id) => ({ id, name: names.get(id) ?? 'Unknown team' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // "Aces plays 3 matches: 9:00, 10:20, 11:40 · refs 2: 9:40, 11:00" for the
  // highlighted team (what a captain needs to know about their day).
  readonly highlightSummary = computed(() => {
    const id = this.highlightTeamId();
    if (!id) return null;
    const at = (m: Match) => `${formatTime(m.startTime)} (Court ${m.court})`;
    const matches = this.liveMatches();
    const plays = matches.filter((m) => m.teamAId === id || m.teamBId === id).map(at);
    const refs = matches.filter((m) => m.refTeamId === id).map(at);
    return {
      name: this.teamName().get(id) ?? '',
      count: plays.length,
      times: plays.join(' · '),
      refCount: refs.length,
      refTimes: refs.join(' · '),
    };
  });

  // Pool colours, plus each pool's first start and last finish once there's
  // a schedule ("Pool A · 9:00 – 11:15").
  readonly legend = computed(() => {
    const matches = this.liveMatches();
    const slot = this.slotUsed();
    const poolOf = this.poolIndexOfTeam();
    return this.pools().map((pool, i) => {
      const own = matches.filter((m) => poolOf.get(m.teamAId) === i);
      const span =
        own.length > 0
          ? `${formatTime(own.reduce((a, b) => (a.startTime < b.startTime ? a : b)).startTime)} – ${formatTime(scheduleEnd(own, slot)!)}`
          : null;
      return { name: pool.name, colour: i % POOL_COLOURS, span };
    });
  });

  ngOnInit(): void {
    this.form.controls.courts.setValue(Math.max(COURTS_MIN, this.pools().length || 2));
    this.form.controls.startTime.setValue(this.lobbyStart() ? toLocalInput(this.lobbyStart()!) : '');
    this.form.controls.courts.valueChanges.subscribe((v) => this.courts.set(Number(v)));
    this.form.controls.slotMinutes.valueChanges.subscribe((v) => this.slotMinutes.set(Number(v)));
    this.form.controls.startTime.valueChanges.subscribe((v) => this.startValue.set(v));
    this.startValue.set(this.form.controls.startTime.value);
    this.courts.set(this.form.controls.courts.value);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.teamService.listSchedule(this.lobbyId()).subscribe({
      next: (matches) => {
        this.loading.set(false);
        this.show(matches, this.poolsSavedCount());
        this.prefillFrom(matches);
      },
      // 404 = no schedule endpoint on this API version yet, or nothing saved:
      // either way there's nothing to show, and Generate still works.
      error: () => this.loading.set(false),
    });
  }

  stepCourts(delta: number): void {
    const control = this.form.controls.courts;
    control.setValue(clamp(Number(control.value) + delta, COURTS_MIN, COURTS_MAX));
  }

  setSlot(minutes: number): void {
    this.form.controls.slotMinutes.setValue(minutes);
  }

  setCourts(count: number): void {
    this.form.controls.courts.setValue(clamp(count, COURTS_MIN, COURTS_MAX));
  }

  // "Use 3 courts" under the ref-gap warning: the organizer already chose,
  // so regenerate straight away without the replace confirmation.
  regenerateWithCourts(count: number): void {
    this.setCourts(count);
    void this.generate(true);
  }

  onToggle(setting: 'onePoolPerCourt' | 'referees', event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    if (setting === 'onePoolPerCourt') this.onePoolPerCourtChoice.set(on);
    else this.referees.set(on);
  }

  // "One court per pool" needs one court per pool: set that many and tick it.
  useOneCourtPerPool(): void {
    this.setCourts(this.poolCount());
    this.onePoolPerCourtChoice.set(true);
  }

  onHighlight(event: Event): void {
    this.highlightTeamId.set((event.target as HTMLSelectElement).value || null);
  }

  async generate(skipConfirm = false): Promise<void> {
    if (this.generating() || this.blockers().length > 0) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!skipConfirm && this.hasSchedule() && !confirm('Replace the current schedule with a new one?')) return;

    this.generating.set(true);
    this.error.set(null);

    // A drag from a moment ago may still be waiting to autosave. Generating
    // first would let that save land *after* and delete the new schedule.
    const poolsSaved = await this.beforeGenerate()();
    if (!poolsSaved) {
      this.generating.set(false);
      this.error.set('Your latest pool changes didn’t save. Use Retry next to Pools, then generate again.');
      return;
    }

    const { courts, slotMinutes, startTime } = this.form.getRawValue();
    const body: GenerateScheduleRequest = {
      courts: Number(courts),
      slotMinutes: Number(slotMinutes),
      courtMode: this.courtMode(),
      referees: this.referees(),
    };
    if (startTime) body.startTime = new Date(startTime).toISOString(); // local time → UTC
    const savedCountAtSend = this.poolsSavedCount();

    this.teamService.generateSchedule(this.lobbyId(), body).subscribe({
      next: (matches) => {
        this.generating.set(false);
        this.slotUsed.set(body.slotMinutes);
        this.refsUsed.set(body.referees === true);
        this.onePoolPerCourtUsed.set(body.courtMode === 'ONE_POOL_PER_COURT');
        this.highlightTeamId.set(null);
        // If pools saved again while we waited, the server may already have
        // deleted this schedule; recording the old count marks it stale.
        this.show(matches, savedCountAtSend);
      },
      error: (err: HttpErrorResponse) => {
        this.generating.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  fieldInvalid(name: 'courts' | 'slotMinutes'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  private show(matches: Match[], savedCount: number): void {
    this.matches.set(matches);
    this.matchesAtSave.set(savedCount);
  }

  // Reopening the page: put the saved schedule's settings back in the form, so
  // "Regenerate" starts from what the organizer used last time.
  private prefillFrom(matches: Match[]): void {
    if (matches.length === 0) return;
    const slot = inferSlotMinutes(matches);
    if (slot !== null && slot >= SLOT_MIN && slot <= SLOT_MAX) {
      this.slotUsed.set(slot);
      this.form.controls.slotMinutes.setValue(slot);
    }
    this.form.controls.courts.setValue(Math.max(...matches.map((m) => m.court)));
    // "First match" is not prefilled: it always opens on the tournament's
    // start time. savedStartHint offers the saved schedule's time instead.
    // Not stored by the API: read back from the matches. A schedule where
    // refs were on but nobody was ever free looks like "refs off" here.
    const hadRefs = matches.some((m) => m.refTeamId !== null);
    this.refsUsed.set(hadRefs);
    this.referees.set(hadRefs);
    const pinned = looksOnePoolPerCourt(matches);
    this.onePoolPerCourtUsed.set(pinned);
    this.onePoolPerCourtChoice.set(pinned);
  }

  private toCard(m: Match) {
    const names = this.teamName();
    const poolIndex = this.poolIndexOfTeam().get(m.teamAId) ?? 0;
    const highlight = this.highlightTeamId();
    const teamA = names.get(m.teamAId) ?? 'Unknown team';
    const teamB = names.get(m.teamBId) ?? 'Unknown team';
    const pool = this.pools()[poolIndex]?.name ?? '';
    // Ref line only when the schedule was made with refs; null = a gap.
    const ref = this.refsUsed()
      ? m.refTeamId
        ? (names.get(m.refTeamId) ?? 'Unknown team')
        : null
      : undefined;
    const involved = [m.teamAId, m.teamBId, m.refTeamId];
    const refLabel = ref === undefined ? '' : ref ? `, ref ${ref}` : ', ref: organizer to assign';
    return {
      id: m.id,
      court: m.court,
      pool,
      colour: poolIndex % POOL_COLOURS,
      teamA,
      teamB,
      showRef: ref !== undefined,
      ref,
      aIsHighlighted: highlight === m.teamAId,
      bIsHighlighted: highlight === m.teamBId,
      refIsHighlighted: highlight !== null && highlight === m.refTeamId,
      dimmed: highlight !== null && !involved.includes(highlight),
      label: `Court ${m.court}, ${pool}: ${teamA} versus ${teamB}${refLabel}`,
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? Math.round(value) : min));
}

const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function formatTime(value: string | Date): string {
  return TIME.format(new Date(value));
}

function formatDay(value: Date): string {
  return DAY.format(value);
}

// The API's 409 messages are written for users; show them as they are.
function errorMessage(err: HttpErrorResponse): string {
  if (err.status === 0) return 'Couldn’t reach the server. Check your connection and try again.';
  if (err.status === 409) return err.error?.error?.message ?? 'The pools aren’t ready for a schedule yet.';
  if (err.status === 400) {
    return `Check the settings: ${COURTS_MIN}–${COURTS_MAX} courts and a ${SLOT_MIN}–${SLOT_MAX} minute slot.`;
  }
  if (err.status === 403) return 'Only this tournament’s organizer can generate the schedule.';
  if (err.status === 404) return 'This lobby no longer exists.';
  return 'Couldn’t generate the schedule. Try again.';
}
