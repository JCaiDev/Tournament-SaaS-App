import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TeamService } from '../../../services/team.service';
import { PoolFormat, SetMode } from '../../../models/team';
import { SerialSaver } from '../../../shared/autosave/serial-saver';
import {
  DEFAULT_POOL_FORMAT,
  SETS_MAX,
  SETS_MIN,
  allowedSets,
  describeFormat,
  isValidFormat,
  stepSets,
  switchMode,
} from '../../../shared/match-format/match-format';

// Step 4 of the organizer's setup: how many sets a pool-play match has.
// Score entry (next) checks every score against this on the server.
//
// Every change autosaves with PUT /pool-format (a full replace: both fields
// every time). SerialSaver debounces quick clicks (− − −) into one request and
// never has two in flight, so an older format can't land after a newer one.
@Component({
  selector: 'app-tournament-format',
  templateUrl: './tournament-format.html',
  styleUrl: './tournament-format.css',
})
export class TournamentFormat implements OnInit, OnDestroy {
  private readonly teamService = inject(TeamService);

  readonly lobbyId = input.required<string>();
  // The format saved on the lobby (GET /lobbies/:id). null = the API didn't
  // send one, so the database default applies.
  readonly saved = input<PoolFormat | null>(null);

  // What's on screen, and exactly what gets PUT.
  readonly format = signal<PoolFormat>(DEFAULT_POOL_FORMAT);

  readonly summary = computed(() => describeFormat(this.format()));
  readonly canDecrease = computed(() => stepSets(this.format(), -1) !== this.format().poolSets);
  readonly canIncrease = computed(() => stepSets(this.format(), 1) !== this.format().poolSets);
  // Under the stepper, so the jump by two in best of isn't a surprise.
  readonly choicesHint = computed(() =>
    this.format().poolSetMode === 'BEST_OF'
      ? `Odd numbers only: ${allowedSets('BEST_OF').join(', ')}`
      : `${SETS_MIN} to ${SETS_MAX} sets`,
  );

  readonly saver = new SerialSaver(() => this.teamService.setPoolFormat(this.lobbyId(), this.format()), 400);

  readonly status = computed(() => {
    switch (this.saver.status()) {
      case 'pending':
      case 'saving':
        return 'Saving…';
      case 'saved':
        return 'Saved';
      case 'error':
        return errorMessage(this.saver.error());
      default:
        return '';
    }
  });

  ngOnInit(): void {
    const saved = this.saved();
    if (saved && isValidFormat(saved)) this.format.set(saved);
  }

  // Leaving the page with a click still waiting: send it now.
  ngOnDestroy(): void {
    this.saver.flush();
  }

  setMode(mode: SetMode): void {
    if (mode === this.format().poolSetMode) return;
    this.apply(switchMode(this.format(), mode));
  }

  step(direction: -1 | 1): void {
    this.apply({ ...this.format(), poolSets: stepSets(this.format(), direction) });
  }

  private apply(next: PoolFormat): void {
    const current = this.format();
    if (next.poolSets === current.poolSets && next.poolSetMode === current.poolSetMode) return;
    // The buttons only offer valid formats; this guards against a future bug
    // sending something the API would answer 400 to.
    if (!isValidFormat(next)) return;
    this.format.set(next);
    this.saver.schedule();
  }
}

function errorMessage(err: unknown): string {
  const status = err instanceof HttpErrorResponse ? err.status : -1;
  if (status === 0) return 'Not saved: couldn’t reach the server.';
  if (status === 403) return 'Not saved: only this tournament’s organizer can change the format.';
  if (status === 404) return 'Not saved: this lobby no longer exists.';
  if (status === 409) return 'Not saved: the match format is only for tournaments.';
  return 'Not saved. Try again.';
}
