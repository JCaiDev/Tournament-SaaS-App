import { Match } from '../../models/team';
import {
  formatDuration,
  groupByTime,
  inferSlotMinutes,
  minimumSlots,
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
});
