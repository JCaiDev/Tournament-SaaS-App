import { getUserByIdService } from '../../src/user/user.services';
import { prisma } from '../../src/prisma';
import { Role } from '@prisma/client';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { resetDb, disconnectDb } from '../helpers/db';
import { seedUser } from '../helpers/users'
import { AppError } from '../../src/errors/AppErrors';

describe("getUserByIdService Integration", () => {
    // 1. setup: database wipe
    beforeAll(async () => {
        await resetDb();
    })
    // 2. cleanup: wipe the data after every single test
    // ensure tests dont interfere with each other
    afterEach(async () => {
        await resetDb()
    })
    // 3. teardown
    afterAll( async () => {
        await disconnectDb();
    })

    it('should return a user if the ID exist and active', async () => {
        const testUser = await seedUser()
        const result = await getUserByIdService(testUser.id);

        expect(result.id).toBe(testUser.id)
        expect(result).not.toHaveProperty('email')
        expect(result).not.toHaveProperty('passwordHash')
    })

    it('should throw an AppError when user is soft-deleted or not in system', async () => {
        const testUser = await seedUser()
        await prisma.user.update({
            where: {id: testUser.id},
            data: {deletedAt: new Date()}
        })
        await expect(getUserByIdService(testUser.id)).rejects.toThrow(AppError)
    })

    it('should throw an AppError when user is not in system', async () => {
    const fakeId = "123e4567-e89b-12d3-a456-426614174000";

    await expect(getUserByIdService(fakeId)).rejects.toThrow(AppError);
});
})