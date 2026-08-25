import request from 'supertest';
import { app } from '../../src/app'
import { resetDb, disconnectDb } from '../helpers/db';
import { seedUser } from '../helpers/users';
import { makeAuthHeader } from '../helpers/auth';
import { describe, it, expect, afterAll, beforeAll, afterEach } from '@jest/globals'


describe('GET /users/id (GET User API)', () => {
    beforeAll( async () => {await resetDb()})

    afterEach( async () => {await resetDb()})

    afterAll( async () => {await disconnectDb()})

    it('Happy Path: Should return 200 and return user object', async () => {
        
        const testUser = await seedUser()

        const res = await request(app)
            .get(`/users/${testUser.id}`)
            .set('Authorization', makeAuthHeader(testUser.id))

        expect(res.status).toBe(200)
        expect(res.body.user.name).toBe(testUser.name)
        expect(res.body.user).not.toHaveProperty('email')
        expect(res.body.user).not.toHaveProperty('passwordHash')
    })

    it('Unhappy Path: Invalid Params should return 400 bad request', async () => {
        const res = await request(app)
            .get('/users/invalidID')
            .set('Authorization', makeAuthHeader('11111111-1111-1111-1111-111111111111'))

        expect(res.status).toBe(400)
        expect(res.body.error.message).toBe('Invalid route parameters')
    })


    it('Unhappy Path: Valid Params, but ID does not exist should return 404', async () => {
        const res = await request(app)
            .get('/users/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', makeAuthHeader('11111111-1111-1111-1111-111111111111'))

        expect(res.status).toBe(404)
        expect(res.body.error.message).toBe('User not found')

    })
})