import { googleLoginSchema, loginSchema } from './auth.schemas'
import { Router } from 'express'
import { validateBody } from '../middleware/validate'
import { googleLoginController, loginController, refreshController } from './auth.controller'

const router = Router()

router.post('/google', validateBody(googleLoginSchema), googleLoginController);

router.post('/login', validateBody(loginSchema), loginController)

router.post('/refresh', refreshController)

export default router;