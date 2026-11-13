import { Match } from '../../models/team';
import {
  countRefGaps,
  courtCells,
  formatDuration,
  groupByTime,
  inferSlotMinutes,
  looksOnePoolPerCourt,
  maxRefCourts,
  minimumSlots,
  onePoolPerCourtSlots,
  refDutyRange,
  roundRobinCount,
  scheduleEnd,
} from './schedule-view';

function match(id: string, startTime: string, court: number): Match {
  return {
    id,
    lobbyId: 'L',
    poolId: 'P',
    teamAId: `${id}-a`,
    teamBId: `${id}-b`,
    refTeamId: null,
    court,
    startTime,
  };
}

describe('schedule-view', () => {
  it('roundRobinCount: n(n−1)/2, and 0 below two teams', () => {
    expect(roundRobinCount(0)).toBe(0);
    expect(roundRobinCount(1)).toBe(0);
    expect(roundRobinCount(4)).toBe(6);
    expect(roundRobinCount(5)).toBe(10);
  });

  describe('minimumSlots', () => {
    it('is limited by courts when matches outnumber them', () => {
      // 2 pools of 4 = 12 matches on 2 courts → at least 6 slots
      expect(minimumSlots([4, 4], 2)).toBe(6);
    });

    it('is limited by the pool when courts are plentiful', () => {
      // A pool of 5 needs 5 rounds (one team sits out each round), however many courts.
      expect(minimumSlots([5], 10)).toBe(5);
      expect(minimumSlots([4], 10)).toBe(3);
    });

    it('ignores pools too small to play', () => {
      expect(minimumSlots([1], 2)).toBe(0);
    });
  });

  it('groupByTime: earliest first, courts in order, same instant grouped once', () => {
    const slots = groupByTime([
      match('c', '2026-11-15T09:40:00.000Z', 1),
      match('b', '2026-11-15T09:00:00.000Z', 2),
      match('a', '2026-11-15T09:00:00Z', 1), // same instant, different spelling
    ]);
    expect(slots.map((s) => s.matches.map((m) => m.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('courtCells: one cell per court, null where the court is open', () => {
    const cells = courtCells([match('b', '2026-11-15T09:00:00Z', 3), match('a', '2026-11-15T09:00:00Z', 1)], 4);
    expect(cells.map((c) => c?.id ?? null)).toEqual(['a', null, 'b', null]);
  });

  it('inferSlotMinutes: the smallest gap between start times', () => {
    expect(
      inferSlotMinutes([
        match('a', '2026-11-15T09:00:00Z', 1),
        match('b', '2026-11-15T09:40:00Z', 1),
        match('c', '2026-11-15T10:20:00Z', 1),
      ]),
    ).toBe(40);
    expect(inferSlotMinutes([match('a', '2026-11-15T09:00:00Z', 1), match('b', '2026-11-15T09:00:00Z', 2)])).toBeNull();
  });

  it('scheduleEnd: last start plus one slot', () => {
    const end = scheduleEnd([match('a', '2026-11-15T09:00:00Z', 1), match('b', '2026-11-15T09:40:00Z', 1)], 40);
    expect(end?.toISOString()).toBe('2026-11-15T10:20:00.000Z');
    expect(scheduleEnd([], 40)).toBeNull();
  });

  it('formatDuration', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(160)).toBe('2h 40m');
  });

  it('onePoolPerCourtSlots: as long as the biggest pool', () => {
    // Pool of 4 = 6 matches, pool of 3 = 3 matches, one at a time per court.
    expect(onePoolPerCourtSlots([4, 3])).toBe(6);
    expect(onePoolPerCourtSlots([])).toBe(0);
  });

  it('maxRefCourts: every reffed match uses 3 teams', () => {
    expect(maxRefCourts(8)).toBe(2);
    expect(maxRefCourts(9)).toBe(3);
    expect(maxRefCourts(40)).toBe(13);
    expect(maxRefCourts(2)).toBe(0);
  });

  describe('refs', () => {
    const withRef = (id: string, ref: string | null, teamA = `${id}-a`, teamB = `${id}-b`): Match => ({
      ...match(id, '2026-11-15T09:00:00Z', 1),
      teamAId: teamA,
      teamBId: teamB,
      refTeamId: ref,
    });

    it('countRefGaps: matches with no ref', () => {
      expect(countRefGaps([withRef('a', 'x'), withRef('b', null), withRef('c', null)])).toBe(2);
    });

    it('refDutyRange: counts teams with no duty as 0', () => {
      const matches = [withRef('a', 'T1', 'T2', 'T3'), withRef('b', 'T1', 'T2', 'T3'), withRef('c', 'T2', 'T1', 'T3')];
      expect(refDutyRange(matches, ['T1', 'T2', 'T3'])).toEqual({ min: 0, max: 2 });
    });

    it('refDutyRange: null when nobody refs', () => {
      expect(refDutyRange([withRef('a', null)], ['a-a', 'a-b'])).toBeNull();
    });
  });

  describe('looksOnePoolPerCourt', () => {
    const at = (id: string, poolId: string, court: number): Match => ({ ...match(id, '2026-11-15T09:00:00Z', court), poolId });

    it('true when each pool keeps its own court', () => {
      expect(looksOnePoolPerCourt([at('a', 'P1', 1), at('b', 'P1', 1), at('c', 'P2', 2)])).toBeTrue();
    });

    it('false when a pool moves courts or two pools share one', () => {
      expect(looksOnePoolPerCourt([at('a', 'P1', 1), at('b', 'P1', 2), at('c', 'P2', 3)])).toBeFalse();
      expect(looksOnePoolPerCourt([at('a', 'P1', 1), at('c', 'P2', 1)])).toBeFalse();
    });

    it('false for a single pool or no matches (nothing to tell apart)', () => {
      expect(looksOnePoolPerCourt([at('a', 'P1', 1)])).toBeFalse();
      expect(looksOnePoolPerCourt([])).toBeFalse();
    });
  });
});
