import request from 'supertest'
import { app } from '../../src/app'
import { prisma } from '../../src/prisma'
import { resetDb, disconnectDb } from '../helpers/db'

beforeEach(resetDb)
afterAll(disconnectDb)

// TODO: build email/password auth post-MVP (currently Google-only)
describe.skip('POST /auth/register', () => {
    it('creates a user with a hashed password', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({
                email: 'testuser@sk.ca',
                password: 'password123',
                name: 'Test User',
                age: 25,
            })
        expect(res.status).toBe(201)

        expect(res.body.user).not.toHaveProperty('password')
        expect(res.body.user).not.toHaveProperty('passwordHash')
        
        const user = await prisma.user.findUnique({
            where: { email: 'testuser@sk.ca' },
        })
        
        expect(user).toBeTruthy()
        expect(user!.passwordHash).not.toBe('password123')
    })

})
