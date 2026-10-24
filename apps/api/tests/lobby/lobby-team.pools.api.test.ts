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

// Creates a pool row with teams already in it, to set up an "already saved"
// layout without calling the endpoint under test.
function createPool(lobbyId: string, name: string, teamIds: string[]) {
    return prisma.pool.create({
        data: {
            lobbyId,
            name,
            teams: { connect: teamIds.map((id) => ({ id })) },
        },
    });
}

// Reads every team in the lobby straight from the DB, A→Z, with the name of
// its pool (null = Unassigned), so we check what was actually saved.
async function savedLayout(lobbyId: string) {
    const teams = await prisma.team.findMany({
        where: { lobbyId },
        select: { name: true, pool: { select: { name: true } } },
        orderBy: { name: 'asc' },
    });
    return teams.map((t) => ({ name: t.name, pool: t.pool?.name ?? null }));
}

// Auth (401), role (403 for PLAYER) and "not your lobby" come from shared
// middleware / assertLobbyManager, already covered by other tests, so these
// focus on the pool rules.
describe('PUT /lobbies/:lobbyId/pools (Set Pools)', () => {
    beforeEach(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

    it('Happy Path: 2 pools + 1 unassigned team -> 200, layout saved', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const aces = await createTeam(lobby.id, 'Aces');
        const blockers = await createTeam(lobby.id, 'Blockers');
        const diggers = await createTeam(lobby.id, 'Diggers');
        await createTeam(lobby.id, 'Spikers'); // left out on purpose

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/pools`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({
                pools: [
                    { name: 'Pool B', teamIds: [diggers.id] },
                    { name: 'Pool A', teamIds: [aces.id, blockers.id] },
                ],
            });

        // ASSERT
        expect(res.status).toBe(200);
        // Response is sorted by pool name and includes each pool's teams.
        expect(
            res.body.pools.map((p: { name: string; teams: unknown[] }) => ({
                name: p.name,
                teamCount: p.teams.length,
            })),
        ).toEqual([
            { name: 'Pool A', teamCount: 2 },
            { name: 'Pool B', teamCount: 1 },
        ]);

        expect(await savedLayout(lobby.id)).toEqual([
            { name: 'Aces', pool: 'Pool A' },
            { name: 'Blockers', pool: 'Pool A' },
            { name: 'Diggers', pool: 'Pool B' },
            { name: 'Spikers', pool: null },
        ]);
    });

    // PUT is a full replace: old pools are deleted, and a team that isn't in
    // the new layout falls back to Unassigned (onDelete: SetNull).
    it('Happy Path: saving again replaces the old layout', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const aces = await createTeam(lobby.id, 'Aces');
        const blockers = await createTeam(lobby.id, 'Blockers');
        const oldPool = await createPool(lobby.id, 'Pool A', [
            aces.id,
            blockers.id,
        ]);

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/pools`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ pools: [{ name: 'Pool X', teamIds: [blockers.id] }] });

        // ASSERT
        expect(res.status).toBe(200);
        expect(await prisma.pool.findUnique({ where: { id: oldPool.id } })).toBeNull();
        expect(await savedLayout(lobby.id)).toEqual([
            { name: 'Aces', pool: null },
            { name: 'Blockers', pool: 'Pool X' },
        ]);
    });

    // Security: the count check must match ids by lobbyId too, or an organizer
    // could pull someone else's team into their own pool.
    it("Sad Path: team from another organizer's lobby -> 404, nothing changed", async () => {
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
        await createPool(attackerLobby.id, 'Pool A', [ownTeam.id]);

        // ACT
        const res = await request(app)
            .put(`/lobbies/${attackerLobby.id}/pools`)
            .set('Authorization', makeAuthHeader(attacker.id, Role.ORGANIZER))
            .send({
                pools: [
                    { name: 'Pool B', teamIds: [ownTeam.id, victimTeam.id] },
                ],
            });

        // ASSERT
        expect(res.status).toBe(404);
        expect(res.body.error.message).toBe('Team not found');

        // The check runs before the transaction, so the attacker's old pool
        // wasn't deleted and the victim's team wasn't moved.
        expect(await savedLayout(attackerLobby.id)).toEqual([
            { name: 'Aces', pool: 'Pool A' },
        ]);
        expect(await savedLayout(victimLobby.id)).toEqual([
            { name: 'Blockers', pool: null },
        ]);
    });

    it('Sad Path: same team in two pools -> 400', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const aces = await createTeam(lobby.id, 'Aces');

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/pools`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({
                pools: [
                    { name: 'Pool A', teamIds: [aces.id] },
                    { name: 'Pool B', teamIds: [aces.id] },
                ],
            });

        // ASSERT
        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Invalid request body');
        expect(await savedLayout(lobby.id)).toEqual([
            { name: 'Aces', pool: null },
        ]);
    });

    // Without the Zod refine, @@unique([lobbyId, name]) would throw P2002
    // inside the transaction and the client would get a 500.
    it('Sad Path: two pools with the same name -> 400', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const aces = await createTeam(lobby.id, 'Aces');
        const blockers = await createTeam(lobby.id, 'Blockers');

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/pools`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({
                pools: [
                    { name: 'Pool A', teamIds: [aces.id] },
                    { name: 'Pool A', teamIds: [blockers.id] },
                ],
            });

        // ASSERT
        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Invalid request body');
        expect(await prisma.pool.count({ where: { lobbyId: lobby.id } })).toBe(0);
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
            .put(`/lobbies/${lobby.id}/pools`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ pools: [{ name: 'Pool A', teamIds: [aces.id] }] });

        // ASSERT
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe(
            'Pools are only available for tournaments',
        );
    });
});
