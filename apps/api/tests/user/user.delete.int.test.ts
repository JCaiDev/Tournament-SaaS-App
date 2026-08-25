import request from 'supertest'
import { beforeEach, afterEach, afterAll, it, describe, expect } from '@jest/globals'
import { app } from '../../src/app';
import { Role } from '@prisma/client';
import { resetDb, disconnectDb } from '../helpers/db';
import { seedUser } from '../helpers/users';
import { makeAuthHeader } from '../helpers/auth';

describe("DELETE /users/:id (Delete User By ID)", () => {
    beforeEach( async () => {
        await resetDb()
    })
    afterEach( async () => {
        await resetDb()
    })
    afterAll( async ()=> {
        await disconnectDb()
    })

    it("Happy Path: Return 200 User Successfull Deleted", async () => {
        const testUser = await seedUser({ name: 'Spy from Javelin'})
        const res = await request(app)
            .delete(`/users/${testUser.id}`)
            .set('Authorization', makeAuthHeader('admin', Role.ADMIN))
        expect(res.status).toBe(200)
        expect(res.body.message).toBe('User Successfully Deleted')
    })

    it("Sad Path: Return 400 Invalid ID", async () => {
        const testId = 'javelin'
        const res = await request(app)
            .delete(`/users/${testId}`)
            .set('Authorization', makeAuthHeader('admin', Role.ADMIN))
        expect(res.status).toBe(400)
        expect(res.body.error.message).toBe('Invalid route parameters')
    })
     it("Sad Path: Return 404 - User Already Deleted / Not Found", async () => {
        const testUser = await seedUser({ name: 'Joanna'})
        const adminAuth = makeAuthHeader('admin', Role.ADMIN)
        await request(app).delete(`/users/${testUser.id}`).set('Authorization', adminAuth)
        const res = await request(app).delete(`/users/${testUser.id}`).set('Authorization', adminAuth)
        
        expect(res.status).toBe(404)
        expect(res.body.error.message).toBe('User not found')
    })
})