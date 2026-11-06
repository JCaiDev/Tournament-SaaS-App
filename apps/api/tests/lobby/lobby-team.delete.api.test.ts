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
import { randomUUID } from 'crypto';

// A tournament with one pool of 3 teams and a 3-match draft schedule, written
// straight to the DB so these tests don't depend on POST /schedule.
async function seedScheduledLobby() {
    const organizer = await seedUser();
    const lobby = await seedLobby(organizer.id, {
        format: LobbyFormat.TOURNAMENT,
    });
    const [aces, blockers, diggers] = await Promise.all(
        ['Aces', 'Blockers', 'Diggers'].map((name) =>
            prisma.team.create({ data: { lobbyId: lobby.id, name } }),
        ),
    );
    const pool = await prisma.pool.create({
        data: {
            lobbyId: lobby.id,
            name: 'Pool A',
            teams: {
                connect: [{ id: aces.id }, { id: blockers.id }, { id: diggers.id }],
            },
        },
    });
    const pairs = [
        [aces, blockers],
        [aces, diggers],
        [blockers, diggers],
    ];
    await prisma.match.createMany({
        data: pairs.map(([a, b], i) => ({
            lobbyId: lobby.id,
            poolId: pool.id,
            teamAId: a.id,
            teamBId: b.id,
            court: 1,
            startTime: new Date(lobby.startTime.getTime() + i * 40 * 60_000),
        })),
    });
    return { organizer, lobby, diggers };
}

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

    // Regression (2026-11-06): Match.teamA/teamB are onDelete: Restrict, so
    // deleting a team that had matches threw P2003 -> 500. During the draft,
    // deleting a team throws away the whole draft schedule (Regenerate rebuilds
    // it), in the same transaction as the team delete.
    it('Happy Path: team with a draft schedule -> 204, schedule cleared', async () => {
        // ARRANGE
        const { organizer, lobby, diggers } = await seedScheduledLobby();

        // ACT
        const res = await request(app)
            .delete(`/lobbies/${lobby.id}/teams/${diggers.id}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(204);
        expect(
            await prisma.team.findUnique({ where: { id: diggers.id } }),
        ).toBeNull();
        expect(await prisma.match.count({ where: { lobbyId: lobby.id } })).toBe(0);
    });

    // The match delete runs first inside the transaction. When the team delete
    // then fails (P2025), the rollback must bring the matches back: a request
    // that should change nothing must not wipe the schedule.
    it('Sad Path: unknown team id with a schedule -> 404, schedule kept', async () => {
        // ARRANGE
        const { organizer, lobby } = await seedScheduledLobby();

        // ACT
        const res = await request(app)
            .delete(`/lobbies/${lobby.id}/teams/${randomUUID()}`)
            .set('Authorization', makeAuthHeader(organizer.id, Role.ORGANIZER));

        // ASSERT
        expect(res.status).toBe(404);
        expect(res.body.error.message).toBe('Team not found');
        expect(await prisma.match.count({ where: { lobbyId: lobby.id } })).toBe(3);
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
