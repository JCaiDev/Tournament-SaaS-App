import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppErrors';
import { AddTeamInput } from './lobby-team.schemas';
import * as TeamServices from './lobby-team.services';
import { LobbyIdParamInput } from './lobby.schemas';

export const addTeam = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        if (!req.user)
            return next(new AppError('Authentication required', 401));

        const { lobbyId } = req.validatedParams as LobbyIdParamInput;
        const teamData = req.validatedBody as AddTeamInput;

        const team = await TeamServices.addTeamService(
            lobbyId,
            req.user,
            teamData,
        );

        return res.status(201).json({ message: 'Team added', team });
    } catch (error) {
        next(error);
    }
};
