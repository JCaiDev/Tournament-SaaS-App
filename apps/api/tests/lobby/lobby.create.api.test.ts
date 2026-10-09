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
import { makeAuthHeader } from '../helpers/auth';
import { prisma } from '../../src/prisma';
import { Role, SkillLevel, GenderFormat, LobbyFormat } from '@prisma/client';

// A helper that builds a VALID request body every time.
// Dates are computed relative to "now" so `startTime` is always in the future
// Schema refines: startTime > now, and endTime > startTime
function validLobbyBody() {
    return {
        lobbyName: 'Sunday Intermediate Drop-In',
        location: 'WePlay Sports Dome',
        startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // +1 hour
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // +2 hours
        price: 10,
        skillLevel: SkillLevel.OPEN,
        genderFormat: GenderFormat.COED,
        allowToApply: true,
        format: LobbyFormat.PICKUP,
    };
}

describe('POST /lobbies (Create Lobby)', () => {
    beforeEach(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

    // ---------- WORKED EXAMPLE: happy path ----------
    it('Happy Path: an ORGANIZER creates a lobby -> 201 with a public lobby', async () => {
        // ARRANGE
        // Must seed a REAL user row: createLobbyService stamps organizerId from the
        // token, and Lobby.organizerId is a foreign key -> the user must exist in the DB.
        const organizer = await seedUser();

        // ACT
        const res = await request(app)
            .post('/lobbies')
            // The token's ROLE (ORGANIZER) is what requireRole checks — not the DB row.
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send(validLobbyBody());

        // ASSERT
        expect(res.status).toBe(201);
        expect(res.body.lobby.lobbyName).toBe('Sunday Intermediate Drop-In');
        // organizerId comes from the TOKEN, never the body — this proves that decision:
        expect(res.body.lobby.organizer.id).toBe(organizer.id);
        // publicLobbySelect exposes only public organizer fields — no private data leaked:
        expect(res.body.lobby.organizer).not.toHaveProperty('email');
    });

    // Unauthorized: not logged in, return 401
    // POST /lobbies with NO Authorization header and a valid body.
    it('Unauthorized: not logged in — no/invalid token -> 401', async () => {
        // ACT
        const res = await request(app).post('/lobbies').send(validLobbyBody());

        // ASSERT
        expect(res.status).toBe(401);
    });

    // Forbidden:
    // POST with makeAuthHeader(<some id>, Role.PLAYER) and a valid body.
    it('Forbidden: a PLAYER cannot create a lobby -> 403', async () => {
        // ACT
        const res = await request(app)
            .post('/lobbies')
            .set('Authorization', makeAuthHeader('player-id', Role.PLAYER))
            .send(validLobbyBody());

        // ASSERT
        expect(res.status).toBe(403);
    });

    // TODO 3 — Bad Request:
    // Use an ORGANIZER token but a body that breaks the schema — e.g. endTime BEFORE
    // startTime (exercises your .refine), or omit lobbyName.
    // Q: why does requireRole pass but validateBody fail here? (Think middleware order.)
    it('Bad Request: invalid body -> 400', async () => {
        const organizer = await seedUser();

        const invalidLobbyData = {
            endTime: new Date(Date.now() - 3600),
            startTime: new Date(Date.now()),
        };

        // ACT
        const res = await request(app)
            .post('/lobbies')
            // The token's ROLE (ORGANIZER) is what requireRole checks — not the DB row.
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send(invalidLobbyData);

        // ASSERT
        expect(res.status).toBe(400);
    });

    // ---------- FORMAT ----------

    it('Happy Path: format TOURNAMENT -> 201, saved and returned', async () => {
        // ARRANGE
        const organizer = await seedUser();

        // ACT
        const res = await request(app)
            .post('/lobbies')
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ ...validLobbyBody(), format: LobbyFormat.TOURNAMENT });

        // ASSERT
        expect(res.status).toBe(201);
        expect(res.body.lobby.format).toBe(LobbyFormat.TOURNAMENT);

        const saved = await prisma.lobby.findUnique({
            where: { id: res.body.lobby.id },
        });
        expect(saved?.format).toBe(LobbyFormat.TOURNAMENT);
    });

    // format is required: the client must say which kind of lobby it means.
    it('Sad Path: missing format -> 400, nothing saved', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const { format: _format, ...bodyWithoutFormat } = validLobbyBody();

        // ACT
        const res = await request(app)
            .post('/lobbies')
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send(bodyWithoutFormat);

        // ASSERT
        expect(res.status).toBe(400);
        expect(await prisma.lobby.count()).toBe(0);
    });

    it('Sad Path: unknown format -> 400, nothing saved', async () => {
        // ARRANGE
        const organizer = await seedUser();

        // ACT
        const res = await request(app)
            .post('/lobbies')
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ ...validLobbyBody(), format: 'BANANA' });

        // ASSERT
        expect(res.status).toBe(400);
        expect(await prisma.lobby.count()).toBe(0);
    });
});
