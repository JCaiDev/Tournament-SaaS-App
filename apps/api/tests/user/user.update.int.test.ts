import request from 'supertest'
import { beforeEach, afterEach, afterAll, describe, it, expect } from '@jest/globals'
import { app } from '../../src/app'
import { resetDb, disconnectDb } from '../helpers/db';
import { seedUser } from '../helpers/users';
import { makeAuthHeader } from '../helpers/auth';
import { Role } from '@prisma/client';
import { prisma } from '../../src/prisma';
import argon2 from 'argon2';

describe('PATCH /users/:id (Update User By ID)', ()=> {
    beforeEach( async () => {
        await resetDb()
    })

    afterEach( async () => {
        await resetDb()
    })

    afterAll( async () => {
        await disconnectDb()
    })
    
    it('Happy Path: Should return 200 and the updated user object', async () => {
        const testUser = await seedUser({ name: 'Old Name' })
        const updateData = { 

                name: 'New Alison'
        
        }

        const res = await request(app)
            .patch(`/users/${testUser.id}`)
            .set('Authorization', makeAuthHeader('admin', Role.ADMIN))
            .send(updateData)
        expect(res.status).toBe(200)
        expect(res.body.updatedUser.name).toBe('New Alison')
    })

    it('Sad Path: Return 404 User Does Not Exist', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000'
        const updateData = { 
                name: 'Gina'
        }
        const res = await request(app)
            .patch(`/users/${nonExistentId}`)
            .set('Authorization', makeAuthHeader('admin', Role.ADMIN))
            .send(updateData)
        expect(res.status).toBe(404)
        expect(res.body.error.message).toBe('User not found')
    })

    it('Sad Path: Return 400 Bad Request - Invalid ID', async () => {
        const id = 'Alison'
        const updateData = {
            email: 'allywong@gmail.com'
        }
        const res = await request(app)
            .patch(`/users/${id}`)
            .set('Authorization', makeAuthHeader('admin', Role.ADMIN))
            .send(updateData)
        expect(res.status).toBe(400)
        expect(res.body.error.message).toBe("Invalid route parameters")

    })

    it('Sad Path: Should return 400 for invalid request body data (e.g. wrong type)', async () => {
        const testUser = await seedUser();
        const updateData = {
            name: 12345 // Invalid type, should be string
        };

        const res = await request(app)
            .patch(`/users/${testUser.id}`)
            .set('Authorization', makeAuthHeader('admin', Role.ADMIN))
            .send(updateData);
        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Invalid request body');
    });

    it('Happy Path: Should allow password update and hash it correctly', async () => {
        const testUser = await seedUser();
        const newPassword = 'NewPassword123$';
        const updateData = {
            password: newPassword
        };
    
        const res = await request(app)
            .patch(`/users/${testUser.id}`)
            .set('Authorization', makeAuthHeader('admin', Role.ADMIN))
            .send(updateData);
        expect(res.status).toBe(200);
    
        const updatedUserInDb = await prisma.user.findUnique({ where: { id: testUser.id } });
        expect(updatedUserInDb).not.toBeNull();
        const isPasswordValid = await argon2.verify(updatedUserInDb!.passwordHash!, newPassword);
        expect(isPasswordValid).toBe(true);
    });
})
