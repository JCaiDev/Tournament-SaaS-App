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

// Creates a team row directly in the DB, so these tests don't depend on
// POST /teams working.
function createTeam(lobbyId: string, name: string) {
    return prisma.team.create({ data: { lobbyId, name } });
}

// Creates a pool row with teams already in it, so these tests don't depend on
// PUT /pools working.
function createPool(lobbyId: string, name: string, teamIds: string[]) {
    return prisma.pool.create({
        data: {
            lobbyId,
            name,
            teams: { connect: teamIds.map((id) => ({ id })) },
        },
    });
}

type PoolBody = { name: string; teams: { name: string }[] };

// Pool names in response order, each with its team names sorted A→Z.
// Teams inside a pool have no guaranteed order, so the test sorts them.
function layoutOf(pools: PoolBody[]) {
    return pools.map((p) => ({
        name: p.name,
        teams: p.teams.map((t) => t.name).sort(),
    }));
}

// Pools are a private draft until the tournament goes live, so only this
// lobby's organizer (or an admin) may read them.
describe('GET /lobbies/:lobbyId/pools (List Pools)', () => {
    beforeEach(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

    it('Happy Path: pools sorted by name, each with its teams -> 200', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const aces = await createTeam(lobby.id, 'Aces');
        const blockers = await createTeam(lobby.id, 'Blockers');
        const diggers = await createTeam(lobby.id, 'Diggers');
        await createTeam(lobby.id, 'Spikers'); // Unassigned: in no pool
        // Created B first, so the A→B order must come from orderBy.
        await createPool(lobby.id, 'Pool B', [diggers.id]);
        await createPool(lobby.id, 'Pool A', [blockers.id, aces.id]);

        // ACT
        const res = await request(app)
            .get(`/lobbies/${lobby.id}/pools`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(200);
        // Unassigned teams aren't a pool, so Spikers appears nowhere.
        expect(layoutOf(res.body.pools)).toEqual([
            { name: 'Pool A', teams: ['Aces', 'Blockers'] },
            { name: 'Pool B', teams: ['Diggers'] },
        ]);
    });

    // An empty list is still a list: 200 + [], not 404.
    it('Happy Path: no pools yet -> 200 with []', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        await createTeam(lobby.id, 'Aces');

        // ACT
        const res = await request(app)
            .get(`/lobbies/${lobby.id}/pools`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(200);
        expect(res.body.pools).toEqual([]);
    });

    // Privacy: the draft layout must not leak to other organizers.
    it("Sad Path: another organizer's lobby -> 403", async () => {
        // ARRANGE
        const owner = await seedUser();
        const outsider = await seedUser();
        const lobby = await seedLobby(owner.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const aces = await createTeam(lobby.id, 'Aces');
        await createPool(lobby.id, 'Pool A', [aces.id]);

        // ACT
        const res = await request(app)
            .get(`/lobbies/${lobby.id}/pools`)
            .set('Authorization', makeAuthHeader(outsider.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(403);
        expect(res.body.pools).toBeUndefined();
    });

    it('Sad Path: pickup lobby -> 409', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.PICKUP,
        });

        // ACT
        const res = await request(app)
            .get(`/lobbies/${lobby.id}/pools`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe(
            'Pools are only available for tournaments',
        );
    });
});
