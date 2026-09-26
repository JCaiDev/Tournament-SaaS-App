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
import { resetDb, disconnectDb } from '../helpers/db';
import { seedUser } from '../helpers/users';
import { seedLobby, seedGuest } from '../helpers/lobby';
import { makeAuthHeader } from '../helpers/auth';
import { Role } from '@prisma/client';
import { prisma } from '../../src/prisma';

describe('PATCH /lobbies/:lobbyId/players/:playerId (Update Player)', () => {
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
    // so every update returned 404 "Player not found".
    it('Happy Path: host updates a guest in their own lobby -> 200', async () => {
        // ARRANGE
        const host = await seedUser();
        const lobby = await seedLobby(host.id);
        const bob = await seedGuest(lobby.id);

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/players/${bob.id}`)
            .set('Authorization', makeAuthHeader(host.id, Role.HOST))
            .send({ approved: true, paid: true, position: 'Setter' });

        // ASSERT
        expect(res.status).toBe(200);
        expect(res.body.player.id).toBe(bob.id);
        expect(res.body.player.approved).toBe(true);
        const updatedBob = await prisma.lobbyPlayer.findUnique({
            where: { id: bob.id },
        });
        expect(updatedBob?.approved).toBe(true);
        expect(updatedBob?.paid).toBe(true);
        expect(updatedBob?.position).toBe('Setter');
    });

    it('Sad Path: host updates a player in a lobby they do not own -> 403', async () => {
        // ARRANGE
        const ownerHost = await seedUser();
        const otherHost = await seedUser();
        const lobby = await seedLobby(ownerHost.id);
        const bob = await seedGuest(lobby.id);

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/players/${bob.id}`)
            .set('Authorization', makeAuthHeader(otherHost.id, Role.HOST))
            .send({ paid: true });

        // ASSERT
        expect(res.status).toBe(403);
        expect(res.body.error.statusCode).toBe(403);
        const unchanged = await prisma.lobbyPlayer.findUnique({
            where: { id: bob.id },
        });
        expect(unchanged?.paid).toBe(false);
    });

    // IDOR: same attack as the delete test, via PATCH.
    it('Sad Path: host updates a player from another lobby via their own lobby URL -> 404', async () => {
        // ARRANGE
        const hostA = await seedUser();
        const hostB = await seedUser();
        const lobbyA = await seedLobby(hostA.id);
        const lobbyB = await seedLobby(hostB.id);
        const bob = await seedGuest(lobbyB.id);

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobbyA.id}/players/${bob.id}`)
            .set('Authorization', makeAuthHeader(hostA.id, Role.HOST))
            .send({ paid: true });

        // ASSERT
        expect(res.status).toBe(404);
        expect(res.body.error.statusCode).toBe(404);
        const unchanged = await prisma.lobbyPlayer.findUnique({
            where: { id: bob.id },
        });
        expect(unchanged?.paid).toBe(false);
    });

    it('Sad Path: invalid body -> 400', async () => {
        // ARRANGE
        const host = await seedUser();
        const lobby = await seedLobby(host.id);
        const bob = await seedGuest(lobby.id);

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/players/${bob.id}`)
            .set('Authorization', makeAuthHeader(host.id, Role.HOST))
            .send({ paid: 'yes' });

        // ASSERT
        expect(res.status).toBe(400);
        expect(res.body.error.statusCode).toBe(400);
    });
});
