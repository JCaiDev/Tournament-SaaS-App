import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppErrors';
import {
    AddTeamInput,
    UpdateTeamInput,
    TeamParamInput,
} from './lobby-team.schemas';
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

export const listTeams = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { lobbyId } = req.validatedParams as LobbyIdParamInput;
        const teams = await TeamServices.listTeamsService(lobbyId);
        return res.status(200).json({ message: 'teams', teams });
    } catch (error) {
        next(error);
    }
};

export const updateTeam = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        if (!req.user)
            return next(new AppError('Authentication required', 401));

        const { lobbyId, teamId } = req.validatedParams as TeamParamInput;

        const teamName = req.validatedBody as UpdateTeamInput;
        const team = await TeamServices.updateTeamService(
            lobbyId,
            req.user,
            teamId,
            teamName,
        );
        return res.status(200).json({ message: 'Team name updated', team });
    } catch (error) {
        next(error);
    }
};

export const deleteTeam = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        if (!req.user)
            return next(new AppError('Authentication required', 401));

        const { lobbyId, teamId } = req.validatedParams as TeamParamInput;
        await TeamServices.deleteTeamService(lobbyId, req.user, teamId);
        return res.status(204).send();
    } catch (error) {
        next(error);
    }
};
