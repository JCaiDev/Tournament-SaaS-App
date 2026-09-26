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
import { resetDb, disconnectDb } from '../helpers/db';
import { seedUser } from '../helpers/users';
import { seedLobby, seedGuest } from '../helpers/lobby';
import { makeAuthHeader } from '../helpers/auth';
import { Role } from '@prisma/client';
import { prisma } from '../../src/prisma';

describe('DELETE /lobbies/:lobbyId/players/:playerId (Delete Player)', () => {
    beforeEach(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

    // Regression: assertPlayerInLobby was called with (playerId, lobbyId),
    // so every delete returned 404 "Player not found".
    it('Happy Path: host removes a guest from their own lobby -> 204', async () => {
        // ARRANGE
        const host = await seedUser();
        const lobby = await seedLobby(host.id);
        const bob = await seedGuest(lobby.id);

        // ACT
        const res = await request(app)
            .delete(`/lobbies/${lobby.id}/players/${bob.id}`)
            .set('Authorization', makeAuthHeader(host.id, Role.HOST));

        // ASSERT
        expect(res.status).toBe(204);
        const deletedBob = await prisma.lobbyPlayer.findUnique({
            where: { id: bob.id },
        });
        expect(deletedBob).toBeNull();
    });

    it('Happy Path: ADMIN removes a guest from any lobby -> 204', async () => {
        // ARRANGE
        const host = await seedUser();
        const lobby = await seedLobby(host.id);
        const bob = await seedGuest(lobby.id);

        // ACT
        const res = await request(app)
            .delete(`/lobbies/${lobby.id}/players/${bob.id}`)
            .set('Authorization', makeAuthHeader('admin', Role.ADMIN));

        // ASSERT
        expect(res.status).toBe(204);
        const deletedBob = await prisma.lobbyPlayer.findUnique({
            where: { id: bob.id },
        });
        expect(deletedBob).toBeNull();
    });

    it('Sad Path: not logged in -> 401', async () => {
        // ARRANGE
        const host = await seedUser();
        const lobby = await seedLobby(host.id);
        const bob = await seedGuest(lobby.id);

        // ACT
        const res = await request(app).delete(
            `/lobbies/${lobby.id}/players/${bob.id}`,
        );

        // ASSERT
        expect(res.status).toBe(401);
        expect(res.body.error.statusCode).toBe(401);
        const stillThere = await prisma.lobbyPlayer.findUnique({
            where: { id: bob.id },
        });
        expect(stillThere).not.toBeNull();
    });

    it('Sad Path: PLAYER role -> 403', async () => {
        // ARRANGE
        const host = await seedUser();
        const lobby = await seedLobby(host.id);
        const bob = await seedGuest(lobby.id);

        // ACT
        const res = await request(app)
            .delete(`/lobbies/${lobby.id}/players/${bob.id}`)
            .set('Authorization', makeAuthHeader(host.id, Role.PLAYER));

        // ASSERT
        expect(res.status).toBe(403);
        expect(res.body.error.statusCode).toBe(403);
        const stillThere = await prisma.lobbyPlayer.findUnique({
            where: { id: bob.id },
        });
        expect(stillThere).not.toBeNull();
    });

    it('Sad Path: host deletes a player from a lobby they do not own -> 403', async () => {
        // ARRANGE
        const ownerHost = await seedUser();
        const otherHost = await seedUser();
        const lobby = await seedLobby(ownerHost.id);
        const bob = await seedGuest(lobby.id);

        // ACT
        const res = await request(app)
            .delete(`/lobbies/${lobby.id}/players/${bob.id}`)
            .set('Authorization', makeAuthHeader(otherHost.id, Role.HOST));

        // ASSERT
        expect(res.status).toBe(403);
        expect(res.body.error.statusCode).toBe(403);
        const stillThere = await prisma.lobbyPlayer.findUnique({
            where: { id: bob.id },
        });
        expect(stillThere).not.toBeNull();
    });

    // IDOR: host A passes the manager check for their own lobby, then targets
    // a player in lobby B. 404 (not 403) so we don't confirm the player exists.
    it('Sad Path: host deletes a player from another lobby via their own lobby URL -> 404', async () => {
        // ARRANGE
        const hostA = await seedUser();
        const hostB = await seedUser();
        const lobbyA = await seedLobby(hostA.id);
        const lobbyB = await seedLobby(hostB.id);
        const bob = await seedGuest(lobbyB.id);

        // ACT
        const res = await request(app)
            .delete(`/lobbies/${lobbyA.id}/players/${bob.id}`)
            .set('Authorization', makeAuthHeader(hostA.id, Role.HOST));

        // ASSERT
        expect(res.status).toBe(404);
        expect(res.body.error.statusCode).toBe(404);
        const stillThere = await prisma.lobbyPlayer.findUnique({
            where: { id: bob.id },
        });
        expect(stillThere?.lobbyId).toBe(lobbyB.id);
    });

    it('Sad Path: player does not exist -> 404', async () => {
        // ARRANGE
        const host = await seedUser();
        const lobby = await seedLobby(host.id);

        // ACT
        const res = await request(app)
            .delete(`/lobbies/${lobby.id}/players/${randomUUID()}`)
            .set('Authorization', makeAuthHeader(host.id, Role.HOST));

        // ASSERT
        expect(res.status).toBe(404);
        expect(res.body.error.statusCode).toBe(404);
    });

    it('Sad Path: playerId is not a UUID -> 400', async () => {
        // ARRANGE
        const host = await seedUser();
        const lobby = await seedLobby(host.id);

        // ACT
        const res = await request(app)
            .delete(`/lobbies/${lobby.id}/players/Bob`)
            .set('Authorization', makeAuthHeader(host.id, Role.HOST));

        // ASSERT
        expect(res.status).toBe(400);
        expect(res.body.error.statusCode).toBe(400);
    });
});
