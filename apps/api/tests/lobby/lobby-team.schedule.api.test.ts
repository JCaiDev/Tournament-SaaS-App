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

describe('POST /lobbies/:lobbyId/schedule (Generate Schedule)', () => {
    beforeEach(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

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
