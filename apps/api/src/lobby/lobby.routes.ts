import express from 'express'
import { Router } from 'express'
import { createLobby, deleteLobby, updateLobby } from './lobby.controller'
import { createLobbySchema, lobbyParamSchema, updateLobbySchema } from './lobby.schemas'
import { requireAuth, requireRole } from '../middleware/auth.middleware'
import { Role } from '@prisma/client'
import { validateBody, validateParams, validateQuery } from '../middleware/validate'

import * as LobbyController from './lobby.controller'


const router = Router()

router.get('/', LobbyController.listLobbies)
router.get('/:id', validateParams(lobbyParamSchema), LobbyController.getLobby)

router.post('/', requireAuth, requireRole(Role.HOST, Role.ADMIN), validateBody(createLobbySchema), LobbyController.createLobby)

router.patch('/:id', requireAuth, requireRole(Role.HOST, Role.ADMIN), validateParams(lobbyParamSchema), validateBody(updateLobbySchema), LobbyController.updateLobby)

router.delete('/:id', requireAuth, requireRole(Role.HOST, Role.ADMIN), validateParams(lobbyParamSchema), LobbyController.deleteLobby)

export default router