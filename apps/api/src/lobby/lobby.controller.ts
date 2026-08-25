import { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppErrors'
import { CreateLobbyInput, LobbyParamInput, UpdateLobbyInput } from './lobby.schemas'
import * as LobbyServices from './lobby.services'

export const createLobby = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return next(new AppError('Authentication required', 401))
        }
        const lobbydata = req.validatedBody as CreateLobbyInput
        const lobby = await LobbyServices.createLobbyService(lobbydata, req.user.id)
        return res.status(201).json({ lobby })
    } catch (error) {
        next(error)
    }
}

export const listLobbies = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const lobbies = await LobbyServices.listActiveLobbiesService()
        return res.status(200).json({ lobbies })
    } catch (error) {
        next(error)
    }
}

export const getLobby = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.validatedParams as LobbyParamInput
        const lobby = await LobbyServices.getLobbyByIdService(id)
        return res.status(200).json({ lobby })
    } catch (error) {
        next(error)
    }
}

export const updateLobby = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) return next(new AppError('Authentication required', 401))
        const { id: lobbyId } = req.validatedParams as LobbyParamInput
        const { id: userId, role } = req.user
        const data = req.validatedBody as UpdateLobbyInput

        const lobby = await LobbyServices.updateLobbyService(lobbyId, userId, role, data) 
        return res.status(200).json({ lobby })
    } catch (error) {
        next(error)
    }
}
 
export const deleteLobby = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return next(new AppError('Authentication required', 401))
        }
        const { id: lobbyId } = req.validatedParams as LobbyParamInput
        const { id: userId, role } = req.user 
        await LobbyServices.deleteLobbyService(lobbyId, userId, role)
        return res.status(204).send()
    } catch (error) {
        next(error)
    }
}