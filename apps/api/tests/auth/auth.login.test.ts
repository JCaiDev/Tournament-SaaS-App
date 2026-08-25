import request from 'supertest'
import { app } from '../../src/app'
import { resetDb, disconnectDb } from '../helpers/db'
import { seedUser } from '../helpers/users'
import argon2 from 'argon2'
import type { User } from '@prisma/client'
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'


let megan: User
beforeAll(async ()=> {
    await resetDb()
    const passwordHash = await argon2.hash('password123')
    megan = await seedUser({
        name: 'Megan Goodman',
        email: 'testuser@sk.ca',
        passwordHash,
    })
})
afterAll(disconnectDb)


describe('POST /auth/login', () => {
    it('Login with correct credentials', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({
                email: 'testuser@sk.ca',
                password: 'password123',
            })
        expect(res.status).toBe(200)
        
        expect(res.body).toHaveProperty('accessToken')
        expect(typeof res.body.accessToken).toBe('string')

        expect(res.body.user).not.toHaveProperty('password')
        expect(res.body.user).not.toHaveProperty('passwordHash')
        expect(res.body.user).toMatchObject({
            id: megan.id,
            name: megan.name,
            email: megan.email
        })
    })
    it('Wrong password', async() => {
        const res = await request(app)
            .post('/auth/login')
            .send({
                email: 'testuser@sk.ca',
                password: 'wrongpassword',
            })
        expect(res.status).toBe(401)
        expect(res.body.error.message).toBe('Incorrect Login Credentials')
    })

    it('non existing user', async() => {
        const res = await request(app)
            .post('/auth/login')
            .send({
                email: 'doesNotExistUser@sk.ca',
                password: 'password123',
            })
        expect(res.status).toBe(401)
        expect(res.body.error.message).toBe('Incorrect Login Credentials')
    })

    it('existing user but inactive', async () => {
        await seedUser({
        name: 'Samantha Inactive',
        email: 'inactiveuser@sk.ca',
        deletedAt: new Date()
        })
        const res = await request(app)
            .post('/auth/login')
            .send({
                email: 'inactiveuser@sk.ca',
                password: 'password123',
            })
       expect(res.status).toBe(401)
    })

    it('Google-only account cannot login with a password', async ()=> {
        await seedUser({ 
        name: 'Sabrina google',
        email: 'googleuser@gmail.com', 
        passwordHash: null
    })
        const res = await request(app).post('/auth/login')
        .send({
            email:'googleuser@gmail.com',
            password: 'anyPassword1',
        })
        expect(res.status).toBe(401)
        expect(res.body.error.message).toBe('Incorrect Login Credentials')
    })

})
