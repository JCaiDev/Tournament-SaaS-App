import { Router } from 'express';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health Check
 *     description: Checks if the server is running correctly
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: App is up and running
 */
router.get('/', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});

export default router;
