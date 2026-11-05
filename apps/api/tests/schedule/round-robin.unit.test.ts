import { describe, it, expect } from '@jest/globals';
import { roundRobinPairs } from '../../src/schedule/round-robin';

// Pure function: no DB or HTTP, so no resetDb / request(app) here.
describe('roundRobinPairs', () => {
    // Circle order: round 1 (A-D, B-C), round 2 (A-C, D-B), round 3 (A-B, C-D).
    it('4 teams -> 6 matches in rounds, everyone plays once per round', () => {
        expect(roundRobinPairs(['A', 'B', 'C', 'D'])).toEqual([
            { teamAId: 'A', teamBId: 'D' },
            { teamAId: 'B', teamBId: 'C' },
            { teamAId: 'A', teamBId: 'C' },
            { teamAId: 'D', teamBId: 'B' },
            { teamAId: 'A', teamBId: 'B' },
            { teamAId: 'C', teamBId: 'D' },
        ]);
    });

    // Odd pool: the BYE seat's match is dropped, so each round has 1 real match
    // and a different team sits out each time.
    it('3 teams -> 3 matches, one per round', () => {
        expect(roundRobinPairs(['A', 'B', 'C'])).toEqual([
            { teamAId: 'B', teamBId: 'C' },
            { teamAId: 'A', teamBId: 'C' },
            { teamAId: 'A', teamBId: 'B' },
        ]);
    });

    it('2 teams -> 1 match', () => {
        expect(roundRobinPairs(['A', 'B'])).toEqual([
            { teamAId: 'A', teamBId: 'B' },
        ]);
    });

    it('1 team -> no matches', () => {
        expect(roundRobinPairs(['A'])).toEqual([]);
    });

    it('0 teams -> no matches', () => {
        expect(roundRobinPairs([])).toEqual([]);
    });

    // The circle method's promise, checked instead of trusted: for every pool
    // size, each pair of teams meets exactly once and nobody plays themselves.
    it.each([2, 3, 4, 5, 6, 7, 8])(
        '%i teams -> every pair exactly once',
        (n) => {
            const teamIds = Array.from({ length: n }, (_, k) => `T${k}`);
            const pairs = roundRobinPairs(teamIds);

            // Same key for A-B and B-A, so order inside a match doesn't matter.
            const keys = pairs.map((p) =>
                [p.teamAId, p.teamBId].sort().join('-'),
            );

            expect(pairs).toHaveLength((n * (n - 1)) / 2);
            expect(new Set(keys).size).toBe(keys.length);
            expect(pairs.every((p) => p.teamAId !== p.teamBId)).toBe(true);
        },
    );
});
