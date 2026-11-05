import { describe, it, expect } from '@jest/globals';
import { packMatches } from '../../src/schedule/pack-matches';
import { roundRobinPairs } from '../../src/schedule/round-robin';

type Placed = ReturnType<typeof packMatches>[number];

// Rule checks shared by the bigger cases: in any one slot, no team plays twice
// and no court is used twice.
function expectNoClashes(schedule: Placed[]) {
    const seen = new Set<string>();
    for (const m of schedule) {
        for (const key of [
            `team ${m.teamAId} in slot ${m.slot}`,
            `team ${m.teamBId} in slot ${m.slot}`,
            `court ${m.court} in slot ${m.slot}`,
        ]) {
            expect(seen.has(key)).toBe(false);
            seen.add(key);
        }
    }
}

describe('packMatches', () => {
    // Exact-output tests use a fixed list (the paper exercise), not
    // roundRobinPairs, so a change to the pairing order can't break them.
    it('4 teams, 2 courts -> 3 slots, 2 matches per slot', () => {
        const pairs = [
            { teamAId: 'A', teamBId: 'B' },
            { teamAId: 'A', teamBId: 'C' },
            { teamAId: 'A', teamBId: 'D' },
            { teamAId: 'B', teamBId: 'C' },
            { teamAId: 'B', teamBId: 'D' },
            { teamAId: 'C', teamBId: 'D' },
        ];

        expect(packMatches(pairs, 2)).toEqual([
            { teamAId: 'A', teamBId: 'B', slot: 0, court: 1 },
            { teamAId: 'C', teamBId: 'D', slot: 0, court: 2 },
            { teamAId: 'A', teamBId: 'C', slot: 1, court: 1 },
            { teamAId: 'B', teamBId: 'D', slot: 1, court: 2 },
            { teamAId: 'A', teamBId: 'D', slot: 2, court: 1 },
            { teamAId: 'B', teamBId: 'C', slot: 2, court: 2 },
        ]);
    });

    it('1 court -> one match per slot, in list order', () => {
        const pairs = [
            { teamAId: 'A', teamBId: 'B' },
            { teamAId: 'A', teamBId: 'C' },
            { teamAId: 'B', teamBId: 'C' },
        ];

        expect(packMatches(pairs, 1)).toEqual([
            { teamAId: 'A', teamBId: 'B', slot: 0, court: 1 },
            { teamAId: 'A', teamBId: 'C', slot: 1, court: 1 },
            { teamAId: 'B', teamBId: 'C', slot: 2, court: 1 },
        ]);
    });

    // 4 teams can only play 2 matches at once, so extra courts sit empty.
    it('more courts than teams can use -> never more than 2 matches per slot', () => {
        const schedule = packMatches(roundRobinPairs(['A', 'B', 'C', 'D']), 10);

        expect(schedule.every((m) => m.court <= 2)).toBe(true);
        expect(Math.max(...schedule.map((m) => m.slot))).toBe(2);
    });

    // How the endpoint will call it: every pool's matches in one list, because
    // the courts are shared by the whole tournament.
    it('two pools sharing 3 courts -> every match placed once, no clashes', () => {
        const pairs = [
            ...roundRobinPairs(['A1', 'A2', 'A3', 'A4', 'A5']),
            ...roundRobinPairs(['B1', 'B2', 'B3', 'B4']),
        ];

        const schedule = packMatches(pairs, 3);

        expect(schedule).toHaveLength(pairs.length); // 10 + 6
        expectNoClashes(schedule);
        expect(schedule.every((m) => m.court >= 1 && m.court <= 3)).toBe(true);
    });

    it('no matches -> empty schedule', () => {
        expect(packMatches([], 2)).toEqual([]);
    });

    // Pure function: it must not change the caller's list.
    it('does not modify the input list', () => {
        const pairs = roundRobinPairs(['A', 'B', 'C', 'D']);
        const before = structuredClone(pairs);

        packMatches(pairs, 2);

        expect(pairs).toEqual(before);
    });

    // Without the guard, 0 courts places nothing and the while loop never ends.
    it('0 courts -> throws instead of looping forever', () => {
        const pairs = roundRobinPairs(['A', 'B']);

        expect(() => packMatches(pairs, 0)).toThrow();
    });

    // 5 teams can play at most 2 matches at once, so 10 matches need at least
    // 5 slots. The old nested-loop order took 7 (team E squeezed to the end);
    // circle order reaches the minimum.
    it('5 teams, 3 courts -> 5 slots, the fewest possible', () => {
        const schedule = packMatches(
            roundRobinPairs(['A', 'B', 'C', 'D', 'E']),
            3,
        );

        expect(Math.max(...schedule.map((m) => m.slot))).toBe(4);
        expectNoClashes(schedule);
    });
});
