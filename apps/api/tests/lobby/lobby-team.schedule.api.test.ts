import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    afterAll,
} from '@jest/globals';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { resetDb, disconnectDb } from '../helpers/db';
import { seedUser } from '../helpers/users';
import { seedLobby } from '../helpers/lobby';
import { makeAuthHeader } from '../helpers/auth';
import { LobbyFormat, Role } from '@prisma/client';

const MS_PER_MINUTE = 60_000;

type MatchBody = {
    id: string;
    lobbyId: string;
    poolId: string;
    teamAId: string;
    teamBId: string;
    court: number;
    startTime: string; // JSON turns Dates into ISO strings
};

// Creates a team row directly in the DB, so these tests don't depend on
// POST /teams working.
function createTeam(lobbyId: string, name: string) {
    return prisma.team.create({ data: { lobbyId, name } });
}

// Creates a pool row with teams already in it, without calling PUT /pools.
function createPool(lobbyId: string, name: string, teamIds: string[]) {
    return prisma.pool.create({
        data: {
            lobbyId,
            name,
            teams: { connect: teamIds.map((id) => ({ id })) },
        },
    });
}

// A tournament with Pool A (3 teams) and Pool B (2 teams).
// Round robin: Pool A = 3 matches, Pool B = 1 match, so 4 in total.
async function seedTournament() {
    const organizer = await seedUser();
    const lobby = await seedLobby(organizer.id, {
        format: LobbyFormat.TOURNAMENT,
    });
    const aces = await createTeam(lobby.id, 'Aces');
    const blockers = await createTeam(lobby.id, 'Blockers');
    const diggers = await createTeam(lobby.id, 'Diggers');
    const eagles = await createTeam(lobby.id, 'Eagles');
    const falcons = await createTeam(lobby.id, 'Falcons');
    const poolA = await createPool(lobby.id, 'Pool A', [
        aces.id,
        blockers.id,
        diggers.id,
    ]);
    const poolB = await createPool(lobby.id, 'Pool B', [eagles.id, falcons.id]);

    // id -> name, so assertions can read like "Aces vs Blockers".
    const names: Record<string, string> = {
        [aces.id]: 'Aces',
        [blockers.id]: 'Blockers',
        [diggers.id]: 'Diggers',
        [eagles.id]: 'Eagles',
        [falcons.id]: 'Falcons',
    };
    return { organizer, lobby, poolA, poolB, names };
}

// "Aces vs Blockers", always in A→Z order so the test doesn't care which
// team the generator put first.
function pairing(match: MatchBody, names: Record<string, string>) {
    return [names[match.teamAId], names[match.teamBId]].sort().join(' vs ');
}

// File-level hooks: they apply to every describe block below. (Inside one
// describe, afterAll would disconnect the DB before the next describe runs.)
beforeEach(async () => {
    await resetDb();
});
afterEach(async () => {
    await resetDb();
});
afterAll(async () => {
    await disconnectDb();
});

describe('POST /lobbies/:lobbyId/schedule (Generate Schedule)', () => {
    it('Happy Path: 2 pools, 2 courts -> 201, a valid schedule is saved', async () => {
        // ARRANGE
        const { organizer, lobby, poolA, poolB, names } = await seedTournament();
        const start = new Date('2026-11-15T09:00:00.000Z');

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/schedule`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ courts: 2, startTime: start.toISOString(), slotMinutes: 40 });

        // ASSERT
        expect(res.status).toBe(201);
        const matches: MatchBody[] = res.body.schedule;

        // "Each pair plays once" and "no clashes" are already proven by the
        // unit tests (round-robin, pack-matches). Here we only check what the
        // endpoint adds on top: the poolId tag, slot -> time, sorting, saving.

        // Each match is tagged with the pool its teams came from.
        const inPool = (poolId: string) =>
            matches
                .filter((m) => m.poolId === poolId)
                .map((m) => pairing(m, names))
                .sort();
        expect(inPool(poolA.id)).toEqual([
            'Aces vs Blockers',
            'Aces vs Diggers',
            'Blockers vs Diggers',
        ]);
        expect(inPool(poolB.id)).toEqual(['Eagles vs Falcons']);

        // Slot -> time: the first match starts at `start`, and every match
        // starts on a 40-minute boundary after it.
        const offsets = matches.map(
            (m) => (new Date(m.startTime).getTime() - start.getTime()) / MS_PER_MINUTE,
        );
        expect(Math.min(...offsets)).toBe(0);
        for (const minutes of offsets) expect(minutes % 40).toBe(0);

        // Response is sorted by time, then court.
        const sorted = [...matches].sort(
            (a, b) =>
                new Date(a.startTime).getTime() - new Date(b.startTime).getTime() ||
                a.court - b.court,
        );
        expect(matches).toEqual(sorted);

        // Saved, not just returned: the DB has the same 4 matches, and the
        // slot length is stored on the lobby (in the same transaction).
        expect(await prisma.match.count({ where: { lobbyId: lobby.id } })).toBe(4);
        const savedLobby = await prisma.lobby.findUnique({ where: { id: lobby.id } });
        expect(savedLobby?.slotMinutes).toBe(40);
    });

    it('Happy Path: no startTime in the body -> uses the lobby start time', async () => {
        // ARRANGE
        const { organizer, lobby } = await seedTournament();

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/schedule`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ courts: 2, slotMinutes: 40 });

        // ASSERT
        expect(res.status).toBe(201);
        // Sorted by time, so the first match is the earliest one.
        expect(new Date(res.body.schedule[0].startTime).getTime()).toBe(
            lobby.startTime.getTime(),
        );
    });

    // Generate is a full replace: delete the old schedule, create the new one,
    // in one transaction. Without the deleteMany we'd end up with 8 matches.
    it('Happy Path: generating again replaces the old schedule', async () => {
        // ARRANGE
        const { organizer, lobby } = await seedTournament();
        const auth = makeAuthHeader(organizer.id, Role.ORGANIZER);
        const first = await request(app)
            .post(`/lobbies/${lobby.id}/schedule`)
            .set('Authorization', auth)
            .send({ courts: 2, slotMinutes: 40 });
        const oldIds: string[] = first.body.schedule.map((m: MatchBody) => m.id);

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/schedule`)
            .set('Authorization', auth)
            .send({ courts: 1, slotMinutes: 60 });

        // ASSERT
        expect(res.status).toBe(201);
        expect(await prisma.match.count({ where: { lobbyId: lobby.id } })).toBe(4);
        expect(
            await prisma.match.count({ where: { id: { in: oldIds } } }),
        ).toBe(0);
    });

    // A team outside every pool would get zero matches, so refuse instead.
    it('Sad Path: a team is unassigned -> 409, nothing saved', async () => {
        // ARRANGE
        const { organizer, lobby } = await seedTournament();
        await createTeam(lobby.id, 'Spikers'); // no pool

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/schedule`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ courts: 2, slotMinutes: 40 });

        // ASSERT
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe('1 teams are not in a pool yet');
        expect(await prisma.match.count({ where: { lobbyId: lobby.id } })).toBe(0);
    });

    // A team alone in a pool has nobody to play: same "zero matches" problem.
    it('Sad Path: a pool with only 1 team -> 409, nothing saved', async () => {
        // ARRANGE
        const { organizer, lobby } = await seedTournament();
        const spikers = await createTeam(lobby.id, 'Spikers');
        await createPool(lobby.id, 'Pool C', [spikers.id]);

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/schedule`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ courts: 2, slotMinutes: 40 });

        // ASSERT
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe('Pool C should have at least 2 teams');
        expect(await prisma.match.count({ where: { lobbyId: lobby.id } })).toBe(0);
    });

    it('Sad Path: pickup lobby -> 409', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.PICKUP,
        });

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/schedule`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ courts: 2, slotMinutes: 40 });

        // ASSERT
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe(
            'Auto scheduling is only available for tournaments',
        );
    });

    // Court modes. 2 pools of 4 teams on 1 court, so the pools MUST share it
    // and the order of the list decides who plays when. Each pool has 6 matches.
    describe('courtMode', () => {
        async function seedTwoPoolsOfFour() {
            const organizer = await seedUser();
            const lobby = await seedLobby(organizer.id, {
                format: LobbyFormat.TOURNAMENT,
            });
            const makePool = async (name: string, teamNames: string[]) => {
                const teams = [];
                for (const teamName of teamNames) {
                    teams.push(await createTeam(lobby.id, teamName));
                }
                return createPool(lobby.id, name, teams.map((t) => t.id));
            };
            const poolA = await makePool('Pool A', ['A1', 'A2', 'A3', 'A4']);
            const poolB = await makePool('Pool B', ['B1', 'B2', 'B3', 'B4']);
            return { organizer, lobby, poolA, poolB };
        }

        // "ABAB…": which pool plays in each slot, in time order.
        function poolOrder(matches: MatchBody[], poolAId: string) {
            return matches.map((m) => (m.poolId === poolAId ? 'A' : 'B')).join('');
        }

        async function generate(courtMode?: string) {
            const { organizer, lobby, poolA } = await seedTwoPoolsOfFour();
            const res = await request(app)
                .post(`/lobbies/${lobby.id}/schedule`)
                .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
                .send({ courts: 1, slotMinutes: 40, courtMode });
            return { res, poolA };
        }

        // One pool after another: all of Pool A, then all of Pool B.
        it('WAVES -> the first pool finishes before the next one starts', async () => {
            const { res, poolA } = await generate('WAVES');

            expect(res.status).toBe(201);
            expect(poolOrder(res.body.schedule, poolA.id)).toBe('AAAAAABBBBBB');
        });

        // Round 0 of both pools (2 matches each), then round 1, then round 2.
        it('TAKE_TURNS -> pools alternate round by round', async () => {
            const { res, poolA } = await generate('TAKE_TURNS');

            expect(res.status).toBe(201);
            expect(poolOrder(res.body.schedule, poolA.id)).toBe('AABBAABBAABB');
        });

        // Old clients don't send the field; they keep the behaviour they had.
        it('no courtMode in the body -> behaves like WAVES', async () => {
            const { res, poolA } = await generate(undefined);

            expect(res.status).toBe(201);
            expect(poolOrder(res.body.schedule, poolA.id)).toBe('AAAAAABBBBBB');
        });

        it('unknown courtMode -> 400', async () => {
            const { res } = await generate('FASTEST');

            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe('Invalid request body');
        });
    });

    // Zod stops this before the service: courts 0 would make packMatches throw
    // a plain Error, which would be a 500.
    it('Sad Path: 0 courts -> 400', async () => {
        // ARRANGE
        const { organizer, lobby } = await seedTournament();

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/schedule`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ courts: 0, slotMinutes: 40 });

        // ASSERT
        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Invalid request body');
    });
});

describe('GET /lobbies/:lobbyId/schedule (List Schedule)', () => {
    it('Happy Path: saved matches -> 200, sorted by time then court, this lobby only', async () => {
        // ARRANGE
        const { organizer, lobby, poolA } = await seedTournament();
        const [aces, blockers, diggers] = await prisma.team.findMany({
            where: { poolId: poolA.id },
            orderBy: { name: 'asc' },
        });
        const nine = new Date('2026-11-15T09:00:00.000Z');
        const ten = new Date('2026-11-15T10:00:00.000Z');
        const inPoolA = { lobbyId: lobby.id, poolId: poolA.id };
        // Saved in the WRONG order on purpose. If the service loses its
        // orderBy, the rows come back in this order and the test fails.
        await prisma.match.createMany({
            data: [
                { ...inPoolA, teamAId: aces.id, teamBId: blockers.id, court: 1, startTime: ten },
                { ...inPoolA, teamAId: aces.id, teamBId: diggers.id, court: 2, startTime: nine },
                { ...inPoolA, teamAId: blockers.id, teamBId: diggers.id, court: 1, startTime: nine },
            ],
        });

        // A second tournament with its own match, which must NOT show up.
        const other = await seedTournament();
        const [eagles, falcons] = await prisma.team.findMany({
            where: { poolId: other.poolB.id },
            orderBy: { name: 'asc' },
        });
        await prisma.match.create({
            data: {
                lobbyId: other.lobby.id,
                poolId: other.poolB.id,
                teamAId: eagles.id,
                teamBId: falcons.id,
                court: 1,
                startTime: nine,
            },
        });

        // ACT
        const res = await request(app)
            .get(`/lobbies/${lobby.id}/schedule`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(200);
        const matches: MatchBody[] = res.body.schedule;
        expect(matches.map((m) => [m.startTime, m.court])).toEqual([
            [nine.toISOString(), 1],
            [nine.toISOString(), 2],
            [ten.toISOString(), 1],
        ]);
        for (const match of matches) expect(match.lobbyId).toBe(lobby.id);
    });

    // "No schedule yet" is a true answer, not a missing thing: 200 + [].
    it('Happy Path: nothing generated yet -> 200 with an empty list', async () => {
        // ARRANGE
        const { organizer, lobby } = await seedTournament();

        // ACT
        const res = await request(app)
            .get(`/lobbies/${lobby.id}/schedule`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(200);
        expect(res.body.schedule).toEqual([]);
    });

    // The schedule is a private draft: no login, no data.
    it('Sad Path: no token -> 401', async () => {
        // ARRANGE
        const { lobby } = await seedTournament();

        // ACT
        const res = await request(app).get(`/lobbies/${lobby.id}/schedule`);

        // ASSERT
        expect(res.status).toBe(401);
        expect(res.body.schedule).toBeUndefined();
    });

    // IDOR guard: the right role is not enough, it must be THEIR lobby.
    it('Sad Path: organizer of a different lobby -> 403', async () => {
        // ARRANGE
        const { lobby } = await seedTournament();
        const stranger = await seedUser();

        // ACT
        const res = await request(app)
            .get(`/lobbies/${lobby.id}/schedule`)
            .set('Authorization', makeAuthHeader(stranger.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(403);
        expect(res.body.schedule).toBeUndefined();
    });

    it('Sad Path: lobby does not exist -> 404', async () => {
        // ARRANGE
        const organizer = await seedUser();

        // ACT
        const res = await request(app)
            .get(`/lobbies/${randomUUID()}/schedule`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(404);
        expect(res.body.error.message).toBe('Lobby not found');
    });

    it('Sad Path: pickup lobby -> 409', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.PICKUP,
        });

        // ACT
        const res = await request(app)
            .get(`/lobbies/${lobby.id}/schedule`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe(
            'Pool-play schedules are only available for tournaments',
        );
    });
});
