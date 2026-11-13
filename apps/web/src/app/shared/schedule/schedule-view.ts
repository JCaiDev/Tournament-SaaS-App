import { Match } from '../../models/team';

// Pure helpers for the schedule screen: no Angular, no HTTP, easy to test.
// The real schedule is computed by the API (round robin + court packing);
// these only estimate before generating and arrange the result for display.

const MS_PER_MINUTE = 60_000;

/** Matches in a full round robin of n teams: everyone plays everyone once. */
export function roundRobinCount(teams: number): number {
  return teams < 2 ? 0 : (teams * (teams - 1)) / 2;
}

/**
 * The fewest time slots any schedule could need. Two limits:
 * - courts: you can't play more matches at once than you have courts;
 * - a pool of n can only play floor(n/2) matches at once, so it needs at
 *   least n−1 rounds (even n) or n rounds (odd n, one team sits out each round).
 * The API's greedy packer may need a few more, so the UI says "at least".
 */
export function minimumSlots(poolSizes: number[], courts: number): number {
  if (courts < 1) return 0;
  const total = poolSizes.reduce((sum, n) => sum + roundRobinCount(n), 0);
  const byCourts = Math.ceil(total / courts);
  const byPools = Math.max(0, ...poolSizes.filter((n) => n >= 2).map((n) => (n % 2 === 0 ? n - 1 : n)));
  return Math.max(byCourts, byPools);
}

/**
 * "One court per pool": each pool plays one match at a time on its own
 * court, so the day is as long as the biggest pool's round robin.
 */
export function onePoolPerCourtSlots(poolSizes: number[]): number {
  return Math.max(0, ...poolSizes.map(roundRobinCount));
}

/**
 * Most courts that can all have a ref at once. Every reffed match uses 3
 * teams (2 playing + 1 reffing), so n teams cover floor(n / 3) courts.
 * With at most that many courts, no match is ever left without a ref.
 */
export function maxRefCourts(teamCount: number): number {
  return Math.floor(teamCount / 3);
}

/** Matches with no ref: the organizer covers these ("ref gaps"). */
export function countRefGaps(matches: Match[]): number {
  return matches.filter((m) => m.refTeamId === null).length;
}

/**
 * Fewest and most ref duties across the given teams (teams with none count
 * as 0). null when no match has a ref.
 */
export function refDutyRange(matches: Match[], teamIds: string[]): { min: number; max: number } | null {
  if (!matches.some((m) => m.refTeamId !== null)) return null;
  const counts = new Map(teamIds.map((id) => [id, 0]));
  for (const m of matches) {
    if (m.refTeamId !== null) counts.set(m.refTeamId, (counts.get(m.refTeamId) ?? 0) + 1);
  }
  const values = [...counts.values()];
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * True when the saved schedule looks like "one court per pool": every pool
 * stays on a single court, and no two pools share one. Used to put the
 * setting back in the form when the page reopens (the API doesn't store it).
 */
export function looksOnePoolPerCourt(matches: Match[]): boolean {
  if (matches.length === 0) return false;
  const courtsOfPool = new Map<string, Set<number>>();
  for (const m of matches) {
    courtsOfPool.set(m.poolId, (courtsOfPool.get(m.poolId) ?? new Set()).add(m.court));
  }
  const used = new Set<number>();
  for (const courts of courtsOfPool.values()) {
    if (courts.size !== 1) return false;
    const [court] = courts;
    if (used.has(court)) return false;
    used.add(court);
  }
  return courtsOfPool.size > 1;
}

export interface TimeSlot {
  startTime: string; // ISO, shared by every match in the slot
  matches: Match[]; // sorted by court
}

/** One row per start time, earliest first; courts in order inside each row. */
export function groupByTime(matches: Match[]): TimeSlot[] {
  const byTime = new Map<string, Match[]>();
  for (const match of matches) {
    const key = new Date(match.startTime).toISOString();
    byTime.set(key, [...(byTime.get(key) ?? []), match]);
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([startTime, list]) => ({ startTime, matches: [...list].sort((a, b) => a.court - b.court) }));
}

/**
 * Reads the slot length back from a saved schedule: the smallest gap between
 * two different start times. null when every match starts at the same time.
 */
export function inferSlotMinutes(matches: Match[]): number | null {
  const times = [...new Set(matches.map((m) => new Date(m.startTime).getTime()))].sort((a, b) => a - b);
  let smallest: number | null = null;
  for (let i = 1; i < times.length; i++) {
    const gap = (times[i] - times[i - 1]) / MS_PER_MINUTE;
    if (smallest === null || gap < smallest) smallest = gap;
  }
  return smallest;
}

/** When the last match ends: the latest start plus one slot. */
export function scheduleEnd(matches: Match[], slotMinutes: number): Date | null {
  if (matches.length === 0) return null;
  const last = Math.max(...matches.map((m) => new Date(m.startTime).getTime()));
  return new Date(last + slotMinutes * MS_PER_MINUTE);
}

/** "2h 40m", "45m", "3h". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** ISO → the picker's local "YYYY-MM-DDTHH:mm". */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
