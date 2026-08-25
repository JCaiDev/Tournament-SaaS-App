import request from 'supertest';
import { app } from '../../src/app';
import { Role } from '@prisma/client';
import { resetDb, disconnectDb } from '../helpers/db';
import { seedUser } from '../helpers/users';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';

describe('POST /users (Create User API)', () => {
    // 1. setup & teardown using helps
    beforeAll(async () => {
        await resetDb();
    });
    afterEach(async () => {
        await resetDb();
    });
    afterAll(async () => {
        await disconnectDb();
    });

    it("Happy Path: should return 201 and create a user", async () => {
        const validPaylod = {
            email: 'api_test@test.com',
            password: 'Password123!',
            name: 'API Test User',
            birthDate: '1995-01-01',
        };

        // fire a fake HTTP request at your Express App
        const response = await request(app)
            .post('/users')
            .send(validPaylod)

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('User succesfully created');
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user.email).toBe(validPaylod.email);
    })

    it('Unhappy Path: should return 409 if email already registered', async () => {
        // 1. put a user in the database instantly using a helper function
        await seedUser({ email: 'duplicate_api@test.com' });

        const duplicatePayload = {
            email: 'duplicate_api@test.com',
            password: 'Password123!',
            name: 'Copy Cat',
            birthDate: '2001-01-01',
        };

        const response = await request(app)
            .post('/users')
            .send(duplicatePayload);

        expect(response.status).toBe(409);
        expect(response.body.error.message).toBe('This email is already registered. Please log in with your email');
    });

    it('Unhappy Path: should return 400 if email format is invalid', async () => {
        const badPayload = {
            email: 'not-an-email',
            password: 'Password123!',
            name: 'noEmail User',
            birthDate: '2005-04-25',
        };
        const response = await request(app)
            .post('/users')
            .send(badPayload);
    
        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe('Invalid request body');
    });

        it('Unhappy Path: should return 400 if Request Body does not match schema', async () => {
        const badPayload = {
            email: 'sneaky@gmail.com',
            password: 'Password123!',
            name: 'Sneaky User',
            birthDate: '2005-04-25',
            role: Role.ADMIN,
        };
        const response = await request(app)
            .post('/users')
            .send(badPayload);
    
        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe('Invalid request body');
    });
});
