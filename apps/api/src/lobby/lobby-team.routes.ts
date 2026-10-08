import { Router } from 'express';
import {
    requireAuth,
    requireRole,
    ORGANIZER_ROLES,
} from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validate';
import { lobbyIdParamSchema } from './lobby.schemas';
import { addTeamSchema } from './lobby-team.schemas';
import * as TeamController from './lobby-team.controller';

const router = Router();

router.post(
    '/:lobbyId/teams',
    requireAuth,
    requireRole(...ORGANIZER_ROLES),
    validateParams(lobbyIdParamSchema),
    validateBody(addTeamSchema),
    TeamController.addTeam,
);

router.get(
    '/:lobbyId/teams',
    requireAuth,
    validateParams(lobbyIdParamSchema),
    TeamController.listTeams,
);

export default router;
