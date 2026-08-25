import request from 'supertest'
import { describe, expect, it, beforeEach, afterEach, afterAll } from '@jest/globals'
import { app } from '../../src/app'
import { makeAuthHeader } from './../helpers/auth'
import { resetDb, disconnectDb } from './../helpers/db'
import { seedUser } from './../helpers/users'
import { seedLobby } from './../helpers/lobby'
import { Role } from '@prisma/client'
import { prisma } from '../../src/prisma'
import { randomUUID} from 'crypto'

describe('/DELETE /lobbies (Delete a Lobby)', () => {
    beforeEach( async () => { await resetDb() })
    afterAll( async () => { await disconnectDb() })

    it(`Happy Path: Owner deletes it's lobby`, async() => {
        const host = await seedUser()
        const lobby = await seedLobby(host.id)

        const res = await request(app)
            .delete(`/lobbies/${lobby.id}`)
            .set('Authorization', makeAuthHeader(host.id, Role.HOST))
        
        expect(res.status).toBe(204)
        const deletedLobby = await prisma.lobby.findUnique({
            where: { id: lobby.id}
        })
        expect(deletedLobby).toBeNull()
    })

    it(`Happy Path: ADMIN can delete any lobby`, async() => {
        const host = await seedUser()
        const lobby = await seedLobby(host.id)
   
        const res = await request(app)
            .delete(`/lobbies/${lobby.id}`)
            .set('Authorization', makeAuthHeader('admin', Role.ADMIN))
        
        expect(res.status).toBe(204)
        const deletedLobby = await prisma.lobby.findUnique({
            where: { id: lobby.id}
        })
        expect(deletedLobby).toBeNull()
    })

    it('Sad Path: Host tries to delete lobby owned by another host', async() => {
        const host = await seedUser()
        const lobby = await seedLobby(host.id)
        const evilHost = await seedUser({name: 'evilHost'})
        const res = await request(app).delete(`/lobbies/${lobby.id}`).set('Authorization', makeAuthHeader(evilHost.id, Role.HOST))

        expect(res.status).toBe(403)
        const fetchedLobby = await prisma.lobby.findUnique({
            where: {id: lobby.id}
        })

        expect(fetchedLobby).not.toBeNull()
        expect(fetchedLobby?.lobbyName).toBe('Sunday Intermediate Drop-In')
    })
    //test 4
    it('Sad Path: valid uuid but non existent lobby -> 404', async () => {
        const nonExistentId = randomUUID()        
        const res = await request(app).delete(`/lobbies/${nonExistentId}`).set('Authorization', makeAuthHeader('admin', Role.ADMIN))

        expect(res.status).toBe(404)
    })

    //test 5
     it('Sad Path: no token -> 401', async() => {
        const host = await seedUser()
        const lobby = await seedLobby(host.id)
        const res = await request(app).delete(`/lobbies/${lobby.id}`)

        expect(res.status).toBe(401)
        const stillThere = await prisma.lobby.findUnique({
            where: {id: lobby.id}
        })

        expect(stillThere).not.toBeNull()
    })


    //test 6
    it('Sad Path: PLAYER tries to delete a lobby', async() => {
        const host = await seedUser()
        const lobby = await seedLobby(host.id)
        const player = await seedUser({name: 'player'})
        const res = await request(app).delete(`/lobbies/${lobby.id}`).set('Authorization', makeAuthHeader(player.id))

        expect(res.status).toBe(403)
        const fetchedLobby = await prisma.lobby.findUnique({
            where: {id: lobby.id}
        })

        expect(fetchedLobby).not.toBeNull()
    })

})