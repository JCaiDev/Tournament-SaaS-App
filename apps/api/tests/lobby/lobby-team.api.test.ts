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

// Auth (401), role (403) and lobby-id format (400) come from shared middleware
// already covered by the lobby-player tests, so these focus on team rules.
describe('POST /lobbies/:lobbyId/teams (Add Team)', () => {
    beforeEach(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

    it('Happy Path: organizer adds a team -> 201, name trimmed and saved', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/teams`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ name: '  Spike   Force ' });

        // ASSERT
        expect(res.status).toBe(201);
        expect(res.body.team.name).toBe('Spike Force');
        expect(res.body.team.lobbyId).toBe(lobby.id);

        const saved = await prisma.team.findUnique({
            where: { id: res.body.team.id },
        });
        expect(saved?.name).toBe('Spike Force');
        expect(saved?.captainName).toBeNull();
    });

    it('Happy Path: team with a captain -> 201, captain saved', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/teams`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ name: 'Spike Force', captainName: ' Jackie ' });

        // ASSERT
        expect(res.status).toBe(201);
        expect(res.body.team.captainName).toBe('Jackie');

        const saved = await prisma.team.findUnique({
            where: { id: res.body.team.id },
        });
        expect(saved?.captainName).toBe('Jackie');
    });

    it('Sad Path: organizer of another lobby -> 403', async () => {
        // ARRANGE
        const ownerOrganizer = await seedUser();
        const otherOrganizer = await seedUser();
        const lobby = await seedLobby(ownerOrganizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/teams`)
            .set(
                'Authorization',
                makeAuthHeader(otherOrganizer.id, Role.ORGANIZER),
            )
            .send({ name: 'Spike Force' });

        // ASSERT
        expect(res.status).toBe(403);
        expect(res.body).not.toHaveProperty('team');
        expect(await prisma.team.count()).toBe(0);
    });

    it('Sad Path: pickup lobby -> 409', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.PICKUP,
        });

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/teams`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ name: 'Spike Force' });

        // ASSERT
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe(
            'Teams can only be added to tournaments',
        );
        expect(await prisma.team.count()).toBe(0);
    });

    it('Sad Path: duplicate name in the same lobby -> 409', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        await prisma.team.create({
            data: { lobbyId: lobby.id, name: 'Spike Force' },
        });

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/teams`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ name: 'Spike Force' });

        // ASSERT
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe(
            'A team with that name already exists',
        );
        expect(await prisma.team.count()).toBe(1);
    });

    it('Happy Path: same name in a different lobby -> 201', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobbyA = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const lobbyB = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        await prisma.team.create({
            data: { lobbyId: lobbyA.id, name: 'Spike Force' },
        });

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobbyB.id}/teams`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ name: 'Spike Force' });

        // ASSERT
        expect(res.status).toBe(201);
        expect(res.body.team.lobbyId).toBe(lobbyB.id);
    });

    it('Sad Path: name longer than 50 characters -> 400', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });

        // ACT
        const res = await request(app)
            .post(`/lobbies/${lobby.id}/teams`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ name: 'a'.repeat(51) });

        // ASSERT
        expect(res.status).toBe(400);
        expect(await prisma.team.count()).toBe(0);
    });
});
