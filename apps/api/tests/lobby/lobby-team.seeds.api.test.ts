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
function createTeam(lobbyId: string, name: string, seed: number | null = null) {
    return prisma.team.create({ data: { lobbyId, name, seed } });
}

// Reads every team in the lobby straight from the DB, A→Z, so we check what
// was actually saved, not just what the response said.
function savedSeeds(lobbyId: string) {
    return prisma.team.findMany({
        where: { lobbyId },
        select: { name: true, seed: true },
        orderBy: { name: 'asc' },
    });
}

// Auth (401) and role (403 for PLAYER) come from shared middleware already
// covered by the lobby-player tests, so these focus on seeding rules.
describe('PUT /lobbies/:lobbyId/teams/seeds (Set Seeds)', () => {
    beforeEach(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

    it('Happy Path: seeds 2 of 3 teams -> 200, sorted by seed, unseeded last', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const aces = await createTeam(lobby.id, 'Aces');
        await createTeam(lobby.id, 'Blockers');
        const diggers = await createTeam(lobby.id, 'Diggers');

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/teams/seeds`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ teamIds: [diggers.id, aces.id] });

        // ASSERT
        expect(res.status).toBe(200);
        expect(res.body.teams.map((t: { name: string }) => t.name)).toEqual([
            'Diggers',
            'Aces',
            'Blockers',
        ]);

        expect(await savedSeeds(lobby.id)).toEqual([
            { name: 'Aces', seed: 2 },
            { name: 'Blockers', seed: null },
            { name: 'Diggers', seed: 1 },
        ]);
    });

    // PUT is a full replace: a team left out of the new list loses its seed.
    it('Happy Path: team left out of the new list -> seed cleared', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        await createTeam(lobby.id, 'Aces', 1);
        const blockers = await createTeam(lobby.id, 'Blockers', 2);

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/teams/seeds`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ teamIds: [blockers.id] });

        // ASSERT
        expect(res.status).toBe(200);
        expect(await savedSeeds(lobby.id)).toEqual([
            { name: 'Aces', seed: null },
            { name: 'Blockers', seed: 1 },
        ]);
    });

    // @@unique([lobbyId, seed]) is checked after every statement. Without the
    // "set every seed to NULL" step first, giving Blockers seed 1 while Aces
    // still holds it would fail with P2002.
    it('Happy Path: swap two seeds -> 200, no unique-constraint error', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const aces = await createTeam(lobby.id, 'Aces', 1);
        const blockers = await createTeam(lobby.id, 'Blockers', 2);

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/teams/seeds`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ teamIds: [blockers.id, aces.id] });

        // ASSERT
        expect(res.status).toBe(200);
        expect(await savedSeeds(lobby.id)).toEqual([
            { name: 'Aces', seed: 2 },
            { name: 'Blockers', seed: 1 },
        ]);
    });

    it('Happy Path: empty list -> 200, every seed cleared', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        await createTeam(lobby.id, 'Aces', 1);
        await createTeam(lobby.id, 'Blockers', 2);

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/teams/seeds`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ teamIds: [] });

        // ASSERT
        expect(res.status).toBe(200);
        expect(await savedSeeds(lobby.id)).toEqual([
            { name: 'Aces', seed: null },
            { name: 'Blockers', seed: null },
        ]);
    });

    // Security: the count check must match ids by lobbyId too, or an organizer
    // could seed someone else's team by listing its id in their own lobby.
    it("Sad Path: team from another organizer's lobby -> 404, nothing saved", async () => {
        // ARRANGE
        const attacker = await seedUser();
        const victim = await seedUser();
        const attackerLobby = await seedLobby(attacker.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const victimLobby = await seedLobby(victim.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const ownTeam = await createTeam(attackerLobby.id, 'Aces');
        const victimTeam = await createTeam(victimLobby.id, 'Blockers');

        // ACT
        const res = await request(app)
            .put(`/lobbies/${attackerLobby.id}/teams/seeds`)
            .set('Authorization', makeAuthHeader(attacker.id, Role.ORGANIZER))
            .send({ teamIds: [ownTeam.id, victimTeam.id] });

        // ASSERT
        expect(res.status).toBe(404);
        expect(res.body.error.message).toBe('Team not found');

        // The check runs before the transaction, so not even the
        // attacker's own team was seeded.
        expect(await savedSeeds(attackerLobby.id)).toEqual([
            { name: 'Aces', seed: null },
        ]);
        expect(await savedSeeds(victimLobby.id)).toEqual([
            { name: 'Blockers', seed: null },
        ]);
    });

    it('Sad Path: same team listed twice -> 400', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const aces = await createTeam(lobby.id, 'Aces');

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/teams/seeds`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ teamIds: [aces.id, aces.id] });

        // ASSERT
        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Invalid request body');
        expect(await savedSeeds(lobby.id)).toEqual([
            { name: 'Aces', seed: null },
        ]);
    });

    it('Sad Path: pickup lobby -> 409', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.PICKUP,
        });
        const aces = await createTeam(lobby.id, 'Aces');

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/teams/seeds`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ teamIds: [aces.id] });

        // ASSERT
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe(
            'Seeding only available for tournaments',
        );
    });
});
