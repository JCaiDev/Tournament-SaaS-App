import { Router } from 'express'
import { Role } from '@prisma/client'
import { requireAuth, requireRole } from '../middleware/auth.middleware'
import { validateBody, validateParams } from '../middleware/validate'
import { lobbyIdParamSchema, addLobbyPlayerSchema, lobbyPlayerParamSchema, updatePlayerSchema } from './lobby-player.schemas'
import * as PlayerController from './lobby-player.controller'

const router = Router()

router.get('/:lobbyId/players', validateParams(lobbyIdParamSchema), PlayerController.listPlayers)

router.post('/:lobbyId/players', requireAuth, requireRole(Role.HOST, Role.ADMIN), validateParams(lobbyIdParamSchema), validateBody(addLobbyPlayerSchema), PlayerController.addPlayer)

router.patch('/:lobbyId/players/:playerId', requireAuth, requireRole(Role.HOST, Role.ADMIN), validateParams(lobbyPlayerParamSchema), validateBody(updatePlayerSchema), PlayerController.updatePlayer)

router.delete('/:lobbyId/players/:playerId', requireAuth, requireRole(Role.HOST, Role.ADMIN), validateParams(lobbyPlayerParamSchema), PlayerController.removePlayer)

export default router