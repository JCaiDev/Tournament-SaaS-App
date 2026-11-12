import { describe, it, expect } from '@jest/globals';
import { assignRefs } from '../../src/schedule/assign-refs';
import { packMatches } from '../../src/schedule/pack-matches';
import { roundRobinPairs } from '../../src/schedule/round-robin';

type Team = { id: string; poolId: string };

// Builds a real packed schedule the same way the service does:
// round robin per pool, tagged with poolId, then packed onto the courts.
function buildSchedule(pools: Record<string, string[]>, courts: number) {
    const pairs = Object.entries(pools).flatMap(([poolId, ids]) =>
        roundRobinPairs(ids).map((pair) => ({ ...pair, poolId })),
    );
    const teams: Team[] = Object.entries(pools).flatMap(([poolId, ids]) =>
        ids.map((id) => ({ id, poolId })),
    );
    return { matches: packMatches(pairs, courts), teams };
}

// Rule checks: a ref never plays in the same slot, and no team refs two
// matches in the same slot.
function expectRefsValid(
    schedule: { teamAId: string; teamBId: string; slot: number; refTeamId: string | null }[],
) {
    const playing = new Set<string>();
    for (const m of schedule) {
        playing.add(`${m.teamAId} in slot ${m.slot}`);
        playing.add(`${m.teamBId} in slot ${m.slot}`);
    }
    const reffing = new Set<string>();
    for (const m of schedule) {
        if (m.refTeamId === null) continue;
        const key = `${m.refTeamId} in slot ${m.slot}`;
        expect(playing.has(key)).toBe(false);
        expect(reffing.has(key)).toBe(false);
        reffing.add(key);
    }
}

function dutyCounts(schedule: { refTeamId: string | null }[], teams: Team[]) {
    const counts = new Map(teams.map((team) => [team.id, 0]));
    for (const m of schedule) {
        if (m.refTeamId !== null)
            counts.set(m.refTeamId, counts.get(m.refTeamId)! + 1);
    }
    return [...counts.values()];
}

describe('assignRefs', () => {
    it('3 teams on 1 court -> the team sitting out refs each match', () => {
        const matches = [
            { teamAId: 'hawks', teamBId: 'owls', poolId: 'A', slot: 0 },
            { teamAId: 'hawks', teamBId: 'bears', poolId: 'A', slot: 1 },
            { teamAId: 'owls', teamBId: 'bears', poolId: 'A', slot: 2 },
        ];
        const teams = [
            { id: 'hawks', poolId: 'A' },
            { id: 'owls', poolId: 'A' },
            { id: 'bears', poolId: 'A' },
        ];

        expect(assignRefs(matches, teams).map((m) => m.refTeamId)).toEqual([
            'bears',
            'owls',
            'hawks',
        ]);
    });

    it('keeps every other field of the match (court, round, ...)', () => {
        const matches = [
            { teamAId: 'a', teamBId: 'b', poolId: 'A', slot: 0, court: 3, round: 0 },
        ];
        const teams = [
            { id: 'a', poolId: 'A' },
            { id: 'b', poolId: 'A' },
            { id: 'c', poolId: 'A' },
        ];

        expect(assignRefs(matches, teams)).toEqual([
            { teamAId: 'a', teamBId: 'b', poolId: 'A', slot: 0, court: 3, round: 0, refTeamId: 'c' },
        ]);
    });

    it('nobody free -> refTeamId is null (a ref gap), not a crash', () => {
        // 4 teams on 2 courts: all 4 play in every slot.
        const { matches, teams } = buildSchedule({ A: ['a', 'b', 'c', 'd'] }, 2);

        const result = assignRefs(matches, teams);

        expect(result.every((m) => m.refTeamId === null)).toBe(true);
    });

    it('one free team, two matches in the slot -> refs only one of them', () => {
        // Slot 0: a-b and c-d play, e is the only free team.
        const matches = [
            { teamAId: 'a', teamBId: 'b', poolId: 'A', slot: 0 },
            { teamAId: 'c', teamBId: 'd', poolId: 'A', slot: 0 },
        ];
        const teams = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, poolId: 'A' }));

        expect(assignRefs(matches, teams).map((m) => m.refTeamId)).toEqual(['e', null]);
    });

    it('any pool: a team from another pool can ref', () => {
        // Pool A has only 2 teams, so only Pool B can ref A's match.
        const matches = [{ teamAId: 'a1', teamBId: 'a2', poolId: 'A', slot: 0 }];
        const teams = [
            { id: 'a1', poolId: 'A' },
            { id: 'a2', poolId: 'A' },
            { id: 'b1', poolId: 'B' },
        ];

        expect(assignRefs(matches, teams)[0].refTeamId).toBe('b1');
    });

    it('samePoolOnly: never picks a team from another pool', () => {
        const matches = [{ teamAId: 'a1', teamBId: 'a2', poolId: 'A', slot: 0 }];
        const teams = [
            { id: 'a1', poolId: 'A' },
            { id: 'a2', poolId: 'A' },
            { id: 'b1', poolId: 'B' },
        ];

        expect(assignRefs(matches, teams, { samePoolOnly: true })[0].refTeamId).toBeNull();
    });

    it('samePoolOnly with one court per pool: every match gets a ref from its own pool', () => {
        // samePoolOnly is used with ONE_POOL_PER_COURT, so pin each pool to its
        // court like the service does: one match per pool per slot leaves a
        // pool-mate free (pools of 3+).
        const { teams } = buildSchedule({ A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', 'b2', 'b3'] }, 2);
        const pairs = [
            ...roundRobinPairs(['a1', 'a2', 'a3', 'a4']).map((p) => ({ ...p, poolId: 'A' })),
            ...roundRobinPairs(['b1', 'b2', 'b3']).map((p) => ({ ...p, poolId: 'B' })),
        ];
        const matches = packMatches(pairs, 2, {
            courtFor: (match) => (match.poolId === 'A' ? 1 : 2),
        });
        const poolOf = new Map(teams.map((team) => [team.id, team.poolId]));

        const result = assignRefs(matches, teams, { samePoolOnly: true });

        expectRefsValid(result);
        for (const m of result) {
            expect(m.refTeamId).not.toBeNull();
            expect(poolOf.get(m.refTeamId!)).toBe(m.poolId);
        }
    });

    it('fair: 2 pools of 4 on 2 courts -> every match reffed, duty counts differ by at most 1', () => {
        const { matches, teams } = buildSchedule(
            { A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', 'b2', 'b3', 'b4'] },
            2,
        );

        const result = assignRefs(matches, teams);

        expectRefsValid(result);
        expect(result.every((m) => m.refTeamId !== null)).toBe(true);
        const counts = dutyCounts(result, teams);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    });

    it.each([
        [{ A: ['a', 'b', 'c'] }, 1],
        [{ A: ['a', 'b', 'c', 'd', 'e'] }, 2],
        [{ A: ['a', 'b', 'c', 'd'], B: ['e', 'f', 'g', 'h'], C: ['i', 'j', 'k'] }, 3],
        [{ A: ['a', 'b', 'c', 'd', 'e'], B: ['f', 'g', 'h', 'i', 'j'] }, 4],
    ])('never refs while playing or twice in one slot (%j on %i courts)', (pools, courts) => {
        const { matches, teams } = buildSchedule(pools, courts);

        expectRefsValid(assignRefs(matches, teams));
        expectRefsValid(assignRefs(matches, teams, { samePoolOnly: true }));
    });
});
