import { prisma } from '../prisma';                                 
import { AppError } from '../errors/AppErrors';
import { AddPlayerInput, UpdatePlayerInput } from "./lobby-player.schemas"
import { Role } from '@prisma/client'
import { AuthUser } from './../types/auth'

const assertLobbyManager = async (lobbyId: string, actor:AuthUser) => {
    const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        select: {
            hostId: true,
        }
    })

    if (!lobby) throw new AppError("Lobby not found", 404)
    const isManager = ( lobby.hostId === actor.id || actor.role === Role.ADMIN )
    if (!isManager) throw new AppError("Forbidden", 403)

}

const assertPlayerInLobby = async (lobbyId:string, playerId:string) => {
    const player = await prisma.lobbyPlayer.findUnique({
        where: { id: playerId},
        select: { lobbyId: true}
    })
    if (!player || player.lobbyId !== lobbyId) throw new AppError("Player not found", 404)
}

export const addLobbyPlayerService = async (lobbyId: string, actor: AuthUser,playerInput: AddPlayerInput, ) => {
    await assertLobbyManager(lobbyId, actor)

    return prisma.lobbyPlayer.create({
        data: {
            lobbyId,
            userId: playerInput.userId ?? null,
            guestName: playerInput.guestName ?? null,
            position: playerInput.position ?? '',
        },
        include: {
            user: { select: { id: true, name: true, pictureUrl: true } }
        }
    })
    
}

export const getLobbyPlayersService = async (lobbyId: string) => {
    return prisma.lobbyPlayer.findMany({
        where: { lobbyId },
        orderBy: { joinedAt: 'asc' },
        include: {
            user: {
                select: { id: true, name: true, pictureUrl:true }
            }
        }
     })
}

export const updateLobbyPlayerService = async (lobbyId:string, playerId: string, actor:AuthUser, data: UpdatePlayerInput) => {
    await assertLobbyManager(lobbyId, actor)
    await assertPlayerInLobby(playerId, lobbyId)

    return prisma.lobbyPlayer.update({
        where: { id: playerId },
        data,
        include: {
            user: { select: { id: true, name: true, pictureUrl: true } }
        }
    })
}

export const removeLobbyPlayerService = async (lobbyId: string, playerId: string, actor:AuthUser ) => {
    await assertLobbyManager(lobbyId, actor)
    await assertPlayerInLobby(playerId, lobbyId)
    return prisma.lobbyPlayer.delete({
        where: { id: playerId }
    })
}