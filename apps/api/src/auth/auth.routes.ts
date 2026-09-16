import { googleLoginSchema, loginSchema } from './auth.schemas';
import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import {
    googleLoginController,
    loginController,
    logoutController,
    refreshController,
} from './auth.controller';

const router = Router();

router.post('/google', validateBody(googleLoginSchema), googleLoginController);

router.post('/login', validateBody(loginSchema), loginController);

router.post('/refresh', refreshController);

router.post('/logout', logoutController);

export default router;
