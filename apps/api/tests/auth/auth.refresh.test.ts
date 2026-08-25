import request from 'supertest';
import { resetDb, disconnectDb } from '../helpers/db';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma';
import crypto, { hash } from 'crypto';
import { seedUser } from '../helpers/users';
import { hashToken } from '../../src/utils/crypto';

beforeEach(resetDb);
afterAll(disconnectDb);

function generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
}

// TODO: build email/password auth post-MVP (currently Google-only)
describe.skip('POST /auth/refresh', () => {
    it('Issues new access token and rotates refresh token', async () => {
        const user = await seedUser();

        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashToken(refreshToken);

        await prisma.refreshToken.create({
            data: {
                tokenHash: refreshTokenHash,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        const res = await request(app)
            .post('/auth/refresh')
            .set('Cookie', [`refreshToken=${refreshToken}`]);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('accessToken');
        expect(typeof res.body.accessToken).toBe('string');

        const setCookie = res.headers['set-cookie'];
        expect(setCookie).toBeDefined();
        expect(setCookie[0]).toContain('refreshToken=');

        // 6. Old token should be revoked
        const oldToken = await prisma.refreshToken.findFirst({
            where: {
                tokenHash: refreshTokenHash,
            },
        });
        expect(oldToken?.revokedAt).not.toBeNull();

        // 7. New refresh token exits
        const activeTokens = await prisma.refreshToken.findMany({
            where: {
                userId: user.id,
                revokedAt: null,
            },
        });
        expect(activeTokens.length).toBe(1);
    });
});
