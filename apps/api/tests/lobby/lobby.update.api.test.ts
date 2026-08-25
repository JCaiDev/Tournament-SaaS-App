import request from 'supertest'
import { describe, it, expect, beforeEach, afterAll } from '@jest/globals'
import { app } from '../../src/app'
import { resetDb, disconnectDb } from '../helpers/db'
import { seedUser } from '../helpers/users'
import { seedLobby } from '../helpers/lobby'
import { makeAuthHeader } from '../helpers/auth'
import { Role, SkillLevel, GenderFormat } from '@prisma/client'
import { randomUUID } from 'crypto'
import { prisma } from '../../src/prisma'

describe('PATCH /lobbies/:id (Update Lobby)', () => {
    beforeEach(async () => { await resetDb() })
    afterAll(async () => { await disconnectDb() })

    // ---------- HAPPY PATHS ----------

    it('Happy Path: Host updates only price and location on own lobby -> 200', async () => {
        // ARRANGE
        const host = await seedUser()
        const lobby = await seedLobby(host.id)

        // ACT — send only two fields (partial update)
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}`)
            .set('Authorization', makeAuthHeader(host.id, Role.HOST))
            .send({ price: 25, location: 'New Sports Complex' })

        // ASSERT
        expect(res.status).toBe(200)
        expect(res.body.message).toBe('Lobby updated')
        expect(res.body.lobby.price).toBe(25)
        expect(res.body.lobby.location).toBe('New Sports Complex')
        // Other fields should remain unchanged from the seed
        expect(res.body.lobby.lobbyName).toBe('Sunday Intermediate Drop-In')
        expect(res.body.lobby.skillLevel).toBe(SkillLevel.OPEN)
        // Host should still be the same
        expect(res.body.lobby.host.id).toBe(host.id)
    })

    it('Happy Path: ADMIN can update any lobby -> 200', async () => {
        // ARRANGE
        const host = await seedUser()
        const lobby = await seedLobby(host.id)

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}`)
            .set('Authorization', makeAuthHeader('admin-user-id', Role.ADMIN))
            .send({ lobbyName: 'Admin Updated Lobby' })

        // ASSERT
        expect(res.status).toBe(200)
        expect(res.body.lobby.lobbyName).toBe('Admin Updated Lobby')
        // host should still be the original host
        expect(res.body.lobby.host.id).toBe(host.id)
    })

    // ---------- AUTH / ROLE SAD PATHS ----------

    it('Sad Path: Not logged in (no token) -> 401', async () => {
        // ARRANGE
        const host = await seedUser()
        const lobby = await seedLobby(host.id)

        // ACT — no Authorization header
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}`)
            .send({ price: 10 })

        // ASSERT
        expect(res.status).toBe(401)
    })

    it('Sad Path: PLAYER cannot update a lobby -> 403', async () => {
        // ARRANGE
        const host = await seedUser()
        const lobby = await seedLobby(host.id)
        const player = await seedUser({ name: 'player' })

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}`)
            .set('Authorization', makeAuthHeader(player.id, Role.PLAYER))
            .send({ price: 10 })

        // ASSERT
        expect(res.status).toBe(403)
    })

    it('Sad Path: Host cannot update lobby owned by another host -> 403', async () => {
        // ARRANGE
        const host = await seedUser()
        const lobby = await seedLobby(host.id)
        const otherHost = await seedUser({ name: 'otherHost' })

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}`)
            .set('Authorization', makeAuthHeader(otherHost.id, Role.HOST))
            .send({ price: 10 })

        // ASSERT
        expect(res.status).toBe(403)

        // Verify the lobby was NOT changed
        const unchanged = await prisma.lobby.findUnique({ where: { id: lobby.id } })
        expect(unchanged?.price).toBe(10) // original seed price
    })

    // ---------- NOT FOUND / VALIDATION SAD PATHS ----------

    it('Sad Path: Non-existent lobby (valid UUID) -> 404', async () => {
        // ARRANGE
        const nonExistentId = randomUUID()

        // ACT
        const res = await request(app)
            .patch(`/lobbies/${nonExistentId}`)
            .set('Authorization', makeAuthHeader('admin', Role.ADMIN))
            .send({ price: 10 })

        // ASSERT
        expect(res.status).toBe(404)
    })

    it('Sad Path: Invalid body (wrong type for skillLevel) -> 400', async () => {
        // ARRANGE
        const host = await seedUser()
        const lobby = await seedLobby(host.id)

        // ACT — skillLevel must be a valid enum value, not a random string
        const res = await request(app)
            .patch(`/lobbies/${lobby.id}`)
            .set('Authorization', makeAuthHeader(host.id, Role.HOST))
            .send({ skillLevel: 'INVALID_LEVEL' })

        // ASSERT
        expect(res.status).toBe(400)
    })
})