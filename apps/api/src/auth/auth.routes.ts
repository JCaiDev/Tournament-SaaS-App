import { googleLoginSchema, loginSchema } from './auth.schemas'
import { Router } from 'express'
import { validateBody } from '../middleware/validate'
import { googleLoginController, loginController } from './auth.controller'

const router = Router()

router.post('/google', validateBody(googleLoginSchema), googleLoginController);

router.post('/login', validateBody(loginSchema), loginController)

export default router;