import request from 'supertest';
import { randomUUID } from 'node:crypto';
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

// Auth (401) and role (403 for PLAYER) come from shared middleware already
// covered by the lobby-player tests, so these focus on team rules.
describe('PATCH /lobbies/:lobbyId/teams/:teamId (Update Team)', () => {
    beforeEach(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

    it('Happy Path: organizer renames a team -> 200, name trimmed and saved', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const team = await prisma.team.create({
            data: { lobbyId: lobby.id, name: 'Spike Force' },
        });

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/teams/${team.id}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ name: '  Block   Party ' });

        // ASSERT
        expect(res.status).toBe(200);
        expect(res.body.team.id).toBe(team.id);
        expect(res.body.team.name).toBe('Block Party');

        const saved = await prisma.team.findUnique({ where: { id: team.id } });
        expect(saved?.name).toBe('Block Party');
    });

    // Security: assertLobbyManager only checks the lobby in the URL, so the
    // team must also be matched by lobbyId or an organizer could rename any
    // team by pairing their own lobby id with someone else's team id.
    it("Sad Path: team from another organizer's lobby -> 404, team unchanged", async () => {
        // ARRANGE
        const attacker = await seedUser();
        const victim = await seedUser();
        const attackerLobby = await seedLobby(attacker.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const victimLobby = await seedLobby(victim.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const victimTeam = await prisma.team.create({
            data: { lobbyId: victimLobby.id, name: 'Spike Force' },
        });

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${attackerLobby.id}/teams/${victimTeam.id}`)
            .set('Authorization', makeAuthHeader(attacker.id, Role.ORGANIZER))
            .send({ name: 'Hacked' });

        // ASSERT
        expect(res.status).toBe(404);
        expect(res.body.error.message).toBe('Team not found');

        const saved = await prisma.team.findUnique({
            where: { id: victimTeam.id },
        });
        expect(saved?.name).toBe('Spike Force');
    });

    it('Sad Path: team id that does not exist -> 404', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/teams/${randomUUID()}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ name: 'Block Party' });

        // ASSERT
        expect(res.status).toBe(404);
        expect(res.body.error.message).toBe('Team not found');
    });

    it('Sad Path: organizer of another lobby -> 403, team unchanged', async () => {
        // ARRANGE
        const ownerOrganizer = await seedUser();
        const otherOrganizer = await seedUser();
        const lobby = await seedLobby(ownerOrganizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const team = await prisma.team.create({
            data: { lobbyId: lobby.id, name: 'Spike Force' },
        });

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/teams/${team.id}`)
            .set(
                'Authorization',
                makeAuthHeader(otherOrganizer.id, Role.ORGANIZER),
            )
            .send({ name: 'Hacked' });

        // ASSERT
        expect(res.status).toBe(403);
        expect(res.body).not.toHaveProperty('team');

        const saved = await prisma.team.findUnique({ where: { id: team.id } });
        expect(saved?.name).toBe('Spike Force');
    });

    it('Sad Path: name taken by another team in the same lobby -> 409', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        await prisma.team.create({
            data: { lobbyId: lobby.id, name: 'Spike Force' },
        });
        const team = await prisma.team.create({
            data: { lobbyId: lobby.id, name: 'Block Party' },
        });

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/teams/${team.id}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ name: 'Spike Force' });

        // ASSERT
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe(
            'A team with that name already exists',
        );

        const saved = await prisma.team.findUnique({ where: { id: team.id } });
        expect(saved?.name).toBe('Block Party');
    });

    it('Sad Path: team id is not a UUID -> 400', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/teams/hello`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ name: 'Block Party' });

        // ASSERT
        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Invalid route parameters');
    });

    it('Sad Path: blank name -> 400, team unchanged', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const team = await prisma.team.create({
            data: { lobbyId: lobby.id, name: 'Spike Force' },
        });

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/teams/${team.id}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ name: '   ' });

        // ASSERT
        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Invalid request body');

        const saved = await prisma.team.findUnique({ where: { id: team.id } });
        expect(saved?.name).toBe('Spike Force');
    });

    // PATCH only touches the fields that were sent: a missing field
    // (undefined) is left alone, null clears it.
    it('Happy Path: captain only -> 200, captain set, name unchanged', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const team = await prisma.team.create({
            data: { lobbyId: lobby.id, name: 'Spike Force' },
        });

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/teams/${team.id}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ captainName: '  Jackie   Dai ' });

        // ASSERT
        expect(res.status).toBe(200);
        expect(res.body.team.captainName).toBe('Jackie Dai');

        const saved = await prisma.team.findUnique({ where: { id: team.id } });
        expect(saved?.captainName).toBe('Jackie Dai');
        expect(saved?.name).toBe('Spike Force');
    });

    it('Happy Path: name only -> 200, existing captain kept', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const team = await prisma.team.create({
            data: {
                lobbyId: lobby.id,
                name: 'Spike Force',
                captainName: 'Jackie',
            },
        });

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/teams/${team.id}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ name: 'Block Party' });

        // ASSERT
        expect(res.status).toBe(200);

        const saved = await prisma.team.findUnique({ where: { id: team.id } });
        expect(saved?.name).toBe('Block Party');
        expect(saved?.captainName).toBe('Jackie');
    });

    it('Happy Path: captainName null -> 200, captain removed', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const team = await prisma.team.create({
            data: {
                lobbyId: lobby.id,
                name: 'Spike Force',
                captainName: 'Jackie',
            },
        });

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/teams/${team.id}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({ captainName: null });

        // ASSERT
        expect(res.status).toBe(200);
        expect(res.body.team.captainName).toBeNull();

        const saved = await prisma.team.findUnique({ where: { id: team.id } });
        expect(saved?.captainName).toBeNull();
        expect(saved?.name).toBe('Spike Force');
    });

    it('Sad Path: empty body -> 400, team unchanged', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const team = await prisma.team.create({
            data: {
                lobbyId: lobby.id,
                name: 'Spike Force',
                captainName: 'Jackie',
            },
        });

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}/teams/${team.id}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER))
            .send({});

        // ASSERT
        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Invalid request body');

        const saved = await prisma.team.findUnique({ where: { id: team.id } });
        expect(saved?.name).toBe('Spike Force');
        expect(saved?.captainName).toBe('Jackie');
    });
});
