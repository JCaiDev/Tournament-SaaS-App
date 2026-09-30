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
import { seedLobby } from '../helpers/lobby';
import { makeAuthHeader } from '../helpers/auth';
import { Role } from '@prisma/client';

describe('POST /lobbies/:lobbyId/players (Add Player)', () => {
    beforeEach(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

    it('Happy Path: organizer adds a guest -> 201 with the player', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id);

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/players`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ guestName: 'Bob' });

        // ASSERT
        expect(res.status).toBe(201);
        expect(res.body.player.guestName).toBe('Bob');
        expect(res.body.player.lobbyId).toBe(lobby.id);
    });

    it('Sad Path: not logged in -> 401', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id);

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/players`)
            .send({ guestName: 'Bob' });

        // ASSERT
        expect(res.status).toBe(401);
        expect(res.body.error.statusCode).toBe(401);
        expect(res.body).not.toHaveProperty('player');
    });

    it('Sad Path: wrong role -> 403', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id);

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/players`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.PLAYER))
            .send({ guestName: 'Bob' });

        // ASSERT
        expect(res.status).toBe(403);
        expect(res.body.error.statusCode).toBe(403);
        expect(res.body).not.toHaveProperty('player');
    });
    it('Sad Path: not the owner -> 403', async () => {
        const ownerOrganizer = await seedUser();
        const otherOrganizer = await seedUser();
        const lobby = await seedLobby(ownerOrganizer.id);

        const res = await request(app)
            .post(`/lobbies/${lobby.id}/players`)
            .set(
                'Authorization',
                makeAuthHeader(otherOrganizer.id, Role.ORGANIZER),
            )
            .send({ guestName: 'Lauren' });

        expect(res.status).toBe(403);
        expect(res.body.error.statusCode).toBe(403);
        expect(res.body).not.toHaveProperty('player');
    });

    it('Sad Path: lobby does not exist -> 404', async () => {
        const organizer = await seedUser();

        const res = await request(app)
            .post(`/lobbies/${organizer.id}/players`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ guestName: 'Lauren' });

        expect(res.status).toBe(404);
        expect(res.body.error.statusCode).toBe(404);
        expect(res.body).not.toHaveProperty('lobby');
    });
    it('Sad Path: invalid body => 400', async () => {
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id);

        const res = await request(app)
            .post(`/lobbies/${lobby.id}/players`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error.statusCode).toBe(400);
        expect(res.body).not.toHaveProperty('lobby');
    });
});
