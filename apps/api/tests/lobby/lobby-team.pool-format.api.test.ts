import request from 'supertest';
import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    afterAll,
} from '@jest/globals';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import { resetDb, disconnectDb } from '../helpers/db';
import { seedUser } from '../helpers/users';
import { seedLobby } from '../helpers/lobby';
import { makeAuthHeader } from '../helpers/auth';
import { LobbyFormat, Role, SetMode } from '@prisma/client';

// Reads the two format columns straight from the DB, so we check what was
// actually saved, not just what the response said.
function savedFormat(lobbyId: string) {
    return prisma.lobby.findUnique({
        where: { id: lobbyId },
        select: { poolSets: true, poolSetMode: true },
    });
}

// Auth (401) and role (403 for PLAYER) come from shared middleware already
// covered by the lobby-player tests, so these focus on the format rules.
describe('PUT /lobbies/:lobbyId/pool-format (Set Pool Format)', () => {
    beforeEach(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

    it('Happy Path: best of 3 -> 200, returns and saves the format', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/pool-format`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ poolSetMode: 'BEST_OF', poolSets: 3 });

        // ASSERT
        expect(res.status).toBe(200);
        // select returns only these two fields, not the whole lobby row.
        expect(res.body.poolFormat).toEqual({
            poolSets: 3,
            poolSetMode: 'BEST_OF',
        });
        expect(await savedFormat(lobby.id)).toEqual({
            poolSets: 3,
            poolSetMode: SetMode.BEST_OF,
        });
    });

    // Regression for the first draft of the schema, where the odd-number
    // refine sat on poolSets alone and rejected every even number.
    it('Happy Path: play all 2 sets -> 200 (even is fine without best of)', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/pool-format`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ poolSetMode: 'PLAY_ALL', poolSets: 2 });

        // ASSERT
        expect(res.status).toBe(200);
        expect(await savedFormat(lobby.id)).toEqual({
            poolSets: 2,
            poolSetMode: SetMode.PLAY_ALL,
        });
    });

    // The mode is required: guessing a default here would silently overwrite
    // a format the organizer already chose. The DB @default only applies
    // when the lobby is created.
    it('Sad Path: mode left out -> 400, saved BEST_OF kept', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
            poolSets: 3,
            poolSetMode: SetMode.BEST_OF,
        });

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/pool-format`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ poolSets: 2 });

        // ASSERT
        expect(res.status).toBe(400);
        expect(await savedFormat(lobby.id)).toEqual({
            poolSets: 3,
            poolSetMode: SetMode.BEST_OF,
        });
    });

    // "Best of 4" can end 2-2, so there's no majority: the refine sees both
    // fields and rejects it before the service runs.
    it('Sad Path: best of an even number -> 400, nothing saved', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/pool-format`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ poolSetMode: 'BEST_OF', poolSets: 4 });

        // ASSERT
        expect(res.status).toBe(400);
        // Still the migration's defaults.
        expect(await savedFormat(lobby.id)).toEqual({
            poolSets: 1,
            poolSetMode: SetMode.PLAY_ALL,
        });
    });

    it.each([
        ['zero sets', { poolSets: 0 }],
        ['more than 5 sets', { poolSets: 6 }],
        ['not a whole number', { poolSets: 2.5 }],
        ['sets missing', { poolSetMode: 'PLAY_ALL' }],
        ['unknown mode', { poolSetMode: 'FIRST_TO', poolSets: 3 }],
    ])('Sad Path: %s -> 400', async (_label, body) => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/pool-format`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send(body);

        // ASSERT
        expect(res.status).toBe(400);
    });

    it('Sad Path: pickup lobby -> 409, nothing saved', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.PICKUP,
        });

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/pool-format`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ poolSetMode: 'BEST_OF', poolSets: 3 });

        // ASSERT
        expect(res.status).toBe(409);
        expect(await savedFormat(lobby.id)).toEqual({
            poolSets: 1,
            poolSetMode: SetMode.PLAY_ALL,
        });
    });

    // The actor comes from the token: an organizer can't change someone
    // else's tournament just by knowing its id.
    it("Sad Path: another organizer's lobby -> 403, nothing saved", async () => {
        // ARRANGE
        const owner = await seedUser();
        const stranger = await seedUser();
        const lobby = await seedLobby(owner.id, {
            format: LobbyFormat.TOURNAMENT,
        });

        // ACT
        const res = await request(app)
            .put(`/lobbies/${lobby.id}/pool-format`)
            .set('Authorization', makeAuthHeader(stranger.id, Role.ORGANIZER))
            .send({ poolSetMode: 'BEST_OF', poolSets: 3 });

        // ASSERT
        expect(res.status).toBe(403);
        expect(await savedFormat(lobby.id)).toEqual({
            poolSets: 1,
            poolSetMode: SetMode.PLAY_ALL,
        });
    });

    it('Sad Path: lobby does not exist -> 404', async () => {
        // ARRANGE
        const organizer = await seedUser();

        // ACT
        const res = await request(app)
            .put(`/lobbies/${randomUUID()}/pool-format`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ poolSetMode: 'BEST_OF', poolSets: 3 });

        // ASSERT
        expect(res.status).toBe(404);
    });
});
