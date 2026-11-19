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
import { LobbyFormat, Role, SetMode } from '@prisma/client';

describe('GET /lobbies/:id (Get Lobby)', () => {
    beforeEach(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

    // Regression: publicLobbySelect left out the pool format, so the web page
    // showed "1 set" after a reload and the next click overwrote the saved one.
    it('Happy Path: Get a lobby with a best of 3, returns lobby', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
            poolSets: 3,
            poolSetMode: SetMode.BEST_OF,
        });

        // ACT
        const res = await request(app)
            .get(`/lobbies/${lobby.id}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(200);
        expect(res.body.lobby).toMatchObject({
            poolSets: 3,
            poolSetMode: 'BEST_OF',
        });
    });
});
