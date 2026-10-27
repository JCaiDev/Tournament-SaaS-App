import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { TeamService } from '../../../services/team.service';
import { PoolLayout, Team } from '../../../models/team';
import { SerialSaver } from '../../../shared/autosave/serial-saver';
import { poolName, snakePools } from '../../../shared/pool-generator/snake-pools';

const UNASSIGNED = -1;

// Same "tablet and up" breakpoint as the teams cards (tournament-teams.css).
const TABLET_UP = '(min-width: 641px)';
// Laptops and desktops.
const LARGE_UP = '(min-width: 1024px)';

interface PoolView {
  name: string;
  teams: Team[];
}

// One card on screen: a pool (key = its index in `layout`) or Unassigned
// (key = UNASSIGNED). The key is also the card's drop-zone data.
interface Column extends PoolView {
  key: number;
}

// Organizer-only draft: rank seeds → Generate pools (snake, in the browser) →
// move teams by hand. Both seeds and pools autosave as a full replace, so the
// state below is exactly what gets PUT. Players can't see any of this until the
// tournament goes live (not built yet), so the parent only shows it to managers.
@Component({
  selector: 'app-tournament-pools',
  imports: [NgTemplateOutlet, CdkDropListGroup, CdkDropList, CdkDrag],
  templateUrl: './tournament-pools.html',
  styleUrl: './tournament-pools.css',
})
export class TournamentPools implements OnInit, OnDestroy {
  private readonly teamService = inject(TeamService);

  readonly lobbyId = input.required<string>();
  // Live list from the parent: a team added there shows up as unseeded +
  // Unassigned here; a deleted one disappears (the API already unlinked it).
  readonly teams = input.required<Team[]>();

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  // Seeded team ids, best first: the body of PUT /teams/seeds.
  readonly seedOrder = signal<string[]>([]);
  // The body of PUT /pools. Team ids may include deleted teams until the next
  // save; the views and request bodies filter them out.
  readonly layout = signal<PoolLayout[]>([]);
  readonly poolCount = signal(1);

  readonly seedSaver = new SerialSaver(() =>
    this.teamService.setSeeds(this.lobbyId(), { teamIds: this.liveIds(this.seedOrder()) }),
  );
  readonly poolSaver = new SerialSaver(() =>
    this.teamService.setPools(this.lobbyId(), {
      pools: this.layout().map((p) => ({ name: p.name, teamIds: this.liveIds(p.teamIds) })),
    }),
  );

  private readonly teamById = computed(() => new Map(this.teams().map((t) => [t.id, t])));

  readonly seededTeams = computed(() => this.toTeams(this.seedOrder()));
  readonly unseededTeams = computed(() => {
    const seeded = new Set(this.seedOrder());
    return sortByName(this.teams().filter((t) => !seeded.has(t.id)));
  });
  // Search box over the unseeded list; only shown once the list gets long.
  readonly searchFrom = 8;
  readonly unseededFilter = signal('');
  readonly filteredUnseeded = computed(() => {
    const query = this.unseededFilter().trim().toLowerCase();
    const teams = this.unseededTeams();
    return query ? teams.filter((t) => t.name.toLowerCase().includes(query)) : teams;
  });
  // Seed number by team id, for the "#1" tags on pool cards.
  readonly seedOf = computed(() => new Map(this.seededTeams().map((t, i) => [t.id, i + 1])));

  readonly poolViews = computed<PoolView[]>(() =>
    this.layout().map((p) => ({ name: p.name, teams: this.seedsFirst(this.toTeams(p.teamIds)) })),
  );
  readonly unassignedTeams = computed(() => {
    const pooled = new Set(this.layout().flatMap((p) => p.teamIds));
    return this.seedsFirst(this.teams().filter((t) => !pooled.has(t.id)));
  });
  // Every card in display order: the pools, then Unassigned last.
  readonly columns = computed<Column[]>(() => [
    ...this.poolViews().map((p, i) => ({ ...p, key: i })),
    { key: UNASSIGNED, name: 'Unassigned', teams: this.unassignedTeams() },
  ]);

  readonly UNASSIGNED = UNASSIGNED;
  // How teams move, by screen width:
  //   phones (≤ 640px)       → "Move to" dropdown only (dragging fights scrolling)
  //   tablets (641–1023px)   → both: drag, or the dropdown if dragging is fiddly
  //   large (≥ 1024px)       → drag only
  // Both update live when the window is resized or a tablet is rotated.
  private readonly breakpoints = inject(BreakpointObserver);
  readonly canDrag = this.matches(TABLET_UP);
  private readonly isLarge = this.matches(LARGE_UP);
  readonly showMenu = computed(() => !this.isLarge());
  // Touch tablets: hold 250ms before a drag starts, so a normal swipe still
  // scrolls the page. Mouse: drag starts right away.
  readonly dragDelay = { touch: 250, mouse: 0 };

  ngOnInit(): void {
    // Seeds come with the team rows the parent already loaded.
    this.seedOrder.set(
      this.teams()
        .filter((t) => t.seed !== null)
        .sort((a, b) => a.seed! - b.seed!)
        .map((t) => t.id),
    );
    this.load();
  }

  // Don't drop a change made in the last second before leaving the page.
  ngOnDestroy(): void {
    this.seedSaver.flush();
    this.poolSaver.flush();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.teamService.listPools(this.lobbyId()).subscribe({
      next: (pools) => {
        this.layout.set(pools.map((p) => ({ name: p.name, teamIds: p.teams.map((t) => t.id) })));
        this.poolCount.set(pools.length || defaultPoolCount(this.teams().length));
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(
          err.status === 403 ? 'Only this tournament’s organizer can see the pools.' : 'Could not load the pools.',
        );
      },
    });
  }

  // ---- Seeds ----

  addSeed(teamId: string): void {
    this.seedOrder.update((ids) => [...this.liveIds(ids), teamId]);
    this.seedSaver.schedule();
  }

  onFilter(event: Event): void {
    this.unseededFilter.set((event.target as HTMLInputElement).value);
  }

  removeSeed(teamId: string): void {
    this.seedOrder.update((ids) => this.liveIds(ids).filter((id) => id !== teamId));
    this.seedSaver.schedule();
  }

  // Swap with the neighbour above (-1) or below (+1).
  moveSeed(index: number, direction: -1 | 1): void {
    const ids = this.liveIds(this.seedOrder());
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.seedOrder.set(ids);
    this.seedSaver.schedule();
  }

  // ---- Pools ----

  setPoolCount(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.poolCount.set(Math.min(Math.max(1, Math.floor(value) || 1), Math.max(1, this.teams().length)));
  }

  generate(): void {
    const hasPools = this.layout().some((p) => this.liveIds(p.teamIds).length > 0);
    if (hasPools && !confirm('Replace the current pools with a new draft?')) return;

    const seeded = this.seededTeams().map((t) => t.id);
    const unseeded = this.unseededTeams().map((t) => t.id);
    const pools = snakePools(seeded, unseeded, this.poolCount());
    this.layout.set(pools.map((teamIds, i) => ({ name: poolName(i), teamIds })));
    this.poolSaver.schedule();
  }

  addPool(): void {
    this.layout.update((pools) => [...pools, { name: poolName(pools.length), teamIds: [] }]);
    this.poolSaver.schedule();
  }

  // Its teams fall back to Unassigned. Pools are re-lettered so names stay
  // A, B, C… with no gaps and no duplicates when a pool is added later.
  removePool(index: number): void {
    this.layout.update((pools) =>
      pools.filter((_, i) => i !== index).map((p, i) => ({ ...p, name: poolName(i) })),
    );
    this.poolSaver.schedule();
  }

  clearPools(): void {
    if (!confirm('Remove all pools? Every team goes back to Unassigned.')) return;
    this.layout.set([]);
    this.poolSaver.schedule();
  }

  // From a team's "Move to" dropdown.
  onMove(teamId: string, event: Event): void {
    this.moveTeam(teamId, Number((event.target as HTMLSelectElement).value));
  }

  // A team was dropped on a card. `previousContainer` is the card it came
  // from, `container` the card it landed on; their data is the column key.
  // Dropping back on the same card changes nothing: order inside a pool isn't
  // saved (cards always sort seeds first, then A–Z).
  onDrop(event: CdkDragDrop<number, number, string>): void {
    if (event.previousContainer === event.container) return;
    this.moveTeam(event.item.data, event.container.data);
  }

  // The one place a team changes pool: take it out of every pool, then add it
  // to `target` (UNASSIGNED adds it nowhere). Then autosave the whole layout.
  private moveTeam(teamId: string, target: number): void {
    this.layout.update((pools) =>
      pools.map((p, i) => {
        const teamIds = p.teamIds.filter((id) => id !== teamId);
        return { ...p, teamIds: i === target ? [...teamIds, teamId] : teamIds };
      }),
    );
    this.poolSaver.schedule();
  }

  saveMessage(saver: SerialSaver): string {
    switch (saver.status()) {
      case 'pending':
      case 'saving':
        return 'Saving…';
      case 'saved':
        return 'All changes saved';
      case 'error':
        return errorMessage(saver.error());
      default:
        return '';
    }
  }

  // Seeded teams first (#1, #2, …), then unseeded teams A–Z. Uses the seed
  // order on screen, so reordering seeds re-sorts the pool cards right away.
  private seedsFirst(teams: Team[]): Team[] {
    const seedOf = this.seedOf();
    return [...teams].sort((a, b) => {
      const sa = seedOf.get(a.id) ?? Infinity;
      const sb = seedOf.get(b.id) ?? Infinity;
      return sa !== sb ? sa - sb : a.name.localeCompare(b.name);
    });
  }

  // A signal that's true while the media query matches.
  private matches(query: string) {
    return toSignal(this.breakpoints.observe(query).pipe(map((state) => state.matches)), {
      initialValue: matchMedia(query).matches,
    });
  }

  private liveIds(ids: string[]): string[] {
    const byId = this.teamById();
    return ids.filter((id) => byId.has(id));
  }

  private toTeams(ids: string[]): Team[] {
    const byId = this.teamById();
    return ids.flatMap((id) => byId.get(id) ?? []);
  }
}

// Pools of about 4 are the usual volleyball setup.
function defaultPoolCount(teamCount: number): number {
  return Math.max(1, Math.round(teamCount / 4));
}

function sortByName(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => a.name.localeCompare(b.name));
}

function errorMessage(err: unknown): string {
  const status = err instanceof HttpErrorResponse ? err.status : 0;
  if (status === 0) return 'Couldn’t save: check your connection.';
  if (status === 404) return 'Couldn’t save: a team was deleted. Reload the page.';
  if (status === 403) return 'Couldn’t save: only this tournament’s organizer can change it.';
  return 'Couldn’t save.';
}
