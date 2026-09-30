import express from 'express';
import { Router } from 'express';
import { createLobby, deleteLobby, updateLobby } from './lobby.controller';
import {
    createLobbySchema,
    lobbyParamSchema,
    updateLobbySchema,
} from './lobby.schemas';
import {
    requireAuth,
    requireRole,
    ORGANIZER_ROLES,
} from '../middleware/auth.middleware';
import {
    validateBody,
    validateParams,
    validateQuery,
} from '../middleware/validate';

import * as LobbyController from './lobby.controller';

const router = Router();

router.get('/', LobbyController.listLobbies);
router.get('/:id', validateParams(lobbyParamSchema), LobbyController.getLobby);

router.post(
    '/',
    requireAuth,
    requireRole(...ORGANIZER_ROLES),
    validateBody(createLobbySchema),
    LobbyController.createLobby,
);

router.patch(
    '/:id',
    requireAuth,
    requireRole(...ORGANIZER_ROLES),
    validateParams(lobbyParamSchema),
    validateBody(updateLobbySchema),
    LobbyController.updateLobby,
);

router.delete(
    '/:id',
    requireAuth,
    requireRole(...ORGANIZER_ROLES),
    validateParams(lobbyParamSchema),
    LobbyController.deleteLobby,
);

export default router;
