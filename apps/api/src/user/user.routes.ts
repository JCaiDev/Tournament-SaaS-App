import { Router } from 'express';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { createUserSchema, userParamSchema, updateUserSchema } from './user.schemas';
import * as UserController from './user.controller'
import { requireAuth, requireRole } from '../middleware/auth.middleware'
import { Role } from '@prisma/client'

const router = Router()

// Create User
router.post('/', validateBody(createUserSchema), UserController.createUser)

// Get User by ID
router.get('/:id', requireAuth, validateParams(userParamSchema), UserController.getUser)

// Update Partial Self
router.patch('/me', requireAuth, validateBody(updateUserSchema), UserController.updateUser)

// Delete Self
router.delete('/me', requireAuth, UserController.deleteUser)

//Admin Only Routes
// Update Partial User Data by ID
router.patch('/:id', requireAuth, requireRole(Role.ADMIN), validateParams(userParamSchema), validateBody(updateUserSchema), UserController.updateUserById)

// Delete User by ID
router.delete('/:id', requireAuth, requireRole(Role.ADMIN), validateParams(userParamSchema), UserController.deleteUserById)

export default router;