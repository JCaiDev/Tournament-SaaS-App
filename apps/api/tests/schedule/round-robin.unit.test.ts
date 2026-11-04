import { describe, it, expect } from '@jest/globals';
import { roundRobinPairs } from '../../src/schedule/round-robin';

// Pure function: no DB or HTTP, so no resetDb / request(app) here.
describe('roundRobinPairs', () => {
    it('4 teams -> 6 matches, each pair once, in list order', () => {
        expect(roundRobinPairs(['A', 'B', 'C', 'D'])).toEqual([
            { teamAId: 'A', teamBId: 'B' },
            { teamAId: 'A', teamBId: 'C' },
            { teamAId: 'A', teamBId: 'D' },
            { teamAId: 'B', teamBId: 'C' },
            { teamAId: 'B', teamBId: 'D' },
            { teamAId: 'C', teamBId: 'D' },
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

    // A pool of 6 is the biggest we expect: checks the n(n-1)/2 count and that
    // no team ever plays itself, without listing all 15 matches by hand.
    it('6 teams -> 15 matches, nobody plays themselves', () => {
        const pairs = roundRobinPairs(['A', 'B', 'C', 'D', 'E', 'F']);

        expect(pairs).toHaveLength(15);
        expect(pairs.every((p) => p.teamAId !== p.teamBId)).toBe(true);
    });
});
