import request from 'supertest'
import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals'
import { app } from '../../src/app'
import { resetDb, disconnectDb } from '../helpers/db'
import { seedUser } from '../helpers/users'
import { makeAuthHeader } from '../helpers/auth'
import { Role, SkillLevel, GenderFormat } from '@prisma/client'

// A helper that builds a VALID request body every time.
// Dates are computed relative to "now" so `startTime` is always in the future
// Schema refines: startTime > now, and endTime > startTime
function validLobbyBody() {
    return {
        lobbyName: 'Sunday Intermediate Drop-In',
        location: 'WePlay Sports Dome',
        startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),      // +1 hour
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),    // +2 hours
        price: 10,
        skillLevel: SkillLevel.OPEN,
        genderFormat: GenderFormat.COED,
        allowToApply: true,
    }
}

describe('POST /lobbies (Create Lobby)', () => {
    beforeEach(async () => { await resetDb() })
    afterEach(async () => { await resetDb() })
    afterAll(async () => { await disconnectDb() })

    // ---------- WORKED EXAMPLE: happy path ----------
    it('Happy Path: a HOST creates a lobby -> 201 with a public lobby', async () => {
        // ARRANGE
        // Must seed a REAL user row: createLobbyService stamps hostId from the
        // token, and Lobby.hostId is a foreign key -> the user must exist in the DB.
        const host = await seedUser()

        // ACT
        const res = await request(app)
            .post('/lobbies')
            // The token's ROLE (HOST) is what requireRole checks — not the DB row.
            .set('Authorization', makeAuthHeader(host.id, Role.HOST))
            .send(validLobbyBody())

        // ASSERT
        expect(res.status).toBe(201)
        expect(res.body.lobby.lobbyName).toBe('Sunday Intermediate Drop-In')
        // hostId comes from the TOKEN, never the body — this proves that decision:
        expect(res.body.lobby.host.id).toBe(host.id)
        // publicLobbySelect exposes only public host fields — no private data leaked:
        expect(res.body.lobby.host).not.toHaveProperty('email')
    })

    // Unauthorized: User is not a host, reutrn 401
    // POST /lobbies with NO Authorization header and a valid body.
    it('Unauthorized: not logged in — no/invalid token -> 401', async () => {

        // ACT
        const res = await request(app)
        .post('/lobbies')
        .send(validLobbyBody())

        // ASSERT
        expect(res.status).toBe(401)
    })

    // Forbidden:
    // POST with makeAuthHeader(<some id>, Role.PLAYER) and a valid body.
    it('Forbidden: a PLAYER cannot create a lobby -> 403', async () => {
        // ACT
        const res = await request(app)
        .post('/lobbies')
        .set('Authorization', makeAuthHeader('player-id', Role.PLAYER))
        .send(validLobbyBody())

        // ASSERT
        expect(res.status).toBe(403)
    })

    // TODO 3 — Bad Request:
    // Use a HOST token but a body that breaks the schema — e.g. endTime BEFORE
    // startTime (exercises your .refine), or omit lobbyName.
    // Q: why does requireRole pass but validateBody fail here? (Think middleware order.)
    it('Bad Request: invalid body -> 400', async () => {
        const host = await seedUser()

        const invalidLobbyData = { endTime: new Date(Date.now()- 3600), startTime: new Date(Date.now())}

        // ACT
        const res = await request(app)
            .post('/lobbies')
            // The token's ROLE (HOST) is what requireRole checks — not the DB row.
            .set('Authorization', makeAuthHeader(host.id, Role.HOST))
            .send(invalidLobbyData)

        // ASSERT
        expect(res.status).toBe(400)
    })
})
