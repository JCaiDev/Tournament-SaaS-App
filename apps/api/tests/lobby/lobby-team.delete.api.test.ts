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

// Auth (401), role (403 for PLAYER) and id format (400) come from shared
// middleware and teamParamSchema, already covered elsewhere.
describe('DELETE /lobbies/:lobbyId/teams/:teamId (Delete Team)', () => {
    beforeEach(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

    it('Happy Path: organizer deletes a team -> 204, row removed', async () => {
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
            .delete(`/lobbies/${lobby.id}/teams/${team.id}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(204);
        expect(res.body).toEqual({});
        expect(await prisma.team.findUnique({ where: { id: team.id } })).toBeNull();
    });

    // Design decision (2026-10-02): deleting a team turns its players into
    // free agents. The DB does this via onDelete: SetNull on RosterEntry.team.
    it("Happy Path: team's roster entries become free agents", async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const team = await prisma.team.create({
            data: { lobbyId: lobby.id, name: 'Spike Force' },
        });
        const entry = await prisma.rosterEntry.create({
            data: { lobbyId: lobby.id, teamId: team.id, name: 'Alice' },
        });

        // ACT
        const res = await request(app)
            .delete(`/lobbies/${lobby.id}/teams/${team.id}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(204);

        const saved = await prisma.rosterEntry.findUnique({
            where: { id: entry.id },
        });
        expect(saved).not.toBeNull();
        expect(saved?.teamId).toBeNull();
    });

    // Security: the team must be matched by lobbyId too, or an organizer could
    // delete any team by pairing their own lobby id with someone else's team id.
    it("Sad Path: team from another organizer's lobby -> 404, team kept", async () => {
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
            .delete(`/lobbies/${attackerLobby.id}/teams/${victimTeam.id}`)
            .set('Authorization', makeAuthHeader(attacker.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(404);
        expect(res.body.error.message).toBe('Team not found');
        expect(
            await prisma.team.findUnique({ where: { id: victimTeam.id } }),
        ).not.toBeNull();
    });

    it('Sad Path: organizer of another lobby -> 403, team kept', async () => {
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
            .delete(`/lobbies/${lobby.id}/teams/${team.id}`)
            .set(
                'Authorization',
                makeAuthHeader(otherOrganizer.id, Role.ORGANIZER),
            );

        // ASSERT
        expect(res.status).toBe(403);
        expect(
            await prisma.team.findUnique({ where: { id: team.id } }),
        ).not.toBeNull();
    });

    it('Sad Path: deleting the same team twice -> 204 then 404', async () => {
        // ARRANGE
        const organizer = await seedUser();
        const lobby = await seedLobby(organizer.id, {
            format: LobbyFormat.TOURNAMENT,
        });
        const team = await prisma.team.create({
            data: { lobbyId: lobby.id, name: 'Spike Force' },
        });
        const url = `/lobbies/${lobby.id}/teams/${team.id}`;
        const auth = makeAuthHeader(organizer.id, Role.ORGANIZER);

        // ACT
        const first = await request(app).delete(url).set('Authorization', auth);
        const second = await request(app).delete(url).set('Authorization', auth);

        // ASSERT
        expect(first.status).toBe(204);
        expect(second.status).toBe(404);
        expect(second.body.error.message).toBe('Team not found');
    });
});
