import { PoolFormat, SetMode } from '../../models/team';

// Same limits as the API's setPoolFormatSchema.
export const SETS_MIN = 1;
export const SETS_MAX = 5;

// What a lobby has before the organizer picks anything (the DB defaults).
export const DEFAULT_POOL_FORMAT: PoolFormat = { poolSets: 1, poolSetMode: 'PLAY_ALL' };

/** Best of N needs a majority, so N must be odd ("best of 2" can end 1–1). */
export function isValidFormat(format: PoolFormat): boolean {
  const { poolSets, poolSetMode } = format;
  if (!Number.isInteger(poolSets) || poolSets < SETS_MIN || poolSets > SETS_MAX) return false;
  return poolSetMode !== 'BEST_OF' || poolSets % 2 === 1;
}

/** The counts the organizer can pick: 1–5 for play all, 1/3/5 for best of. */
export function allowedSets(mode: SetMode): number[] {
  const all = Array.from({ length: SETS_MAX - SETS_MIN + 1 }, (_, i) => SETS_MIN + i);
  return mode === 'BEST_OF' ? all.filter((n) => n % 2 === 1) : all;
}

/**
 * The − / + buttons: one step in play all, two in best of (1 → 3 → 5),
 * never past the limits.
 */
export function stepSets(format: PoolFormat, direction: -1 | 1): number {
  const allowed = allowedSets(format.poolSetMode);
  const next =
    direction === 1
      ? allowed.find((n) => n > format.poolSets)
      : [...allowed].reverse().find((n) => n < format.poolSets);
  return next ?? format.poolSets;
}

/**
 * Switching mode keeps the count when it still fits. An even count switched
 * to best of goes up to the next odd one (2 → 3, 4 → 5): the organizer asked
 * for at least that many sets, so we don't shrink the match.
 */
export function switchMode(format: PoolFormat, mode: SetMode): PoolFormat {
  const fitted = allowedSets(mode).find((n) => n >= format.poolSets) ?? SETS_MAX;
  return { poolSetMode: mode, poolSets: fitted };
}

/** Plain-language summary for organizers, players and (later) the public page. */
export function describeFormat(format: PoolFormat): { title: string; detail: string } {
  const { poolSets: n, poolSetMode: mode } = format;
  if (n === 1) {
    return { title: '1 set', detail: 'One set decides the match.' };
  }
  if (mode === 'BEST_OF') {
    const toWin = Math.floor(n / 2) + 1;
    return {
      title: `Best of ${n}`,
      detail: `The match ends as soon as a team wins ${toWin} sets, so it can last ${toWin}–${n} sets.`,
    };
  }
  return {
    title: `${n} sets`,
    detail:
      n % 2 === 0
        ? `All ${n} sets are played. A match can end tied (e.g. ${n / 2}–${n / 2}), and standings count every set.`
        : `All ${n} sets are played, even after a team has already won the match.`,
  };
}
