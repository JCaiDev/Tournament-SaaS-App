import { CreateLobbyInput, UpdateLobbyInput } from "./lobby.schemas";
import { prisma } from '../prisma';
import { Prisma, Role } from '@prisma/client'
import { publicUserSelect } from "../user/user.services";
import { AppError } from '../errors/AppErrors';


export const publicLobbySelect = {
    id: true,
    lobbyName: true,
    location: true,
    startTime: true,
    endTime: true,
    price: true,
    skillLevel: true,
    genderFormat: true,
    allowToApply: true,
    createdAt: true,
    host: { select: publicUserSelect }
} satisfies Prisma.LobbySelect


export const createLobbyService = async (data:CreateLobbyInput, hostId: string) => {
    return prisma.lobby.create({ 
        data: {...data, hostId },
        select: publicLobbySelect,
    })
}

export const listActiveLobbiesService = async () => {
    return prisma.lobby.findMany({
        where: { endTime: { gt: new Date() } },
        orderBy: { startTime: 'asc' },
        select: publicLobbySelect,
    })
}

export const getLobbyByIdService = async (id: string) => {
    const lobby = await prisma.lobby.findUnique({
        where: { id },
        select: publicLobbySelect,
    })
    if (!lobby) throw new AppError('Lobby not found', 404)
    return lobby
}

export const updateLobbyService = async (id: string, userId: string, role: Role, data: UpdateLobbyInput) => {
    const lobby = await prisma.lobby.findUnique({
        where: { id },
        select: {
            id: true,
            hostId: true
        }
    })

    if (!lobby) throw new AppError('Lobby not found', 404)
    if (lobby.hostId !== userId && role !== Role.ADMIN) throw new AppError('Access Denied', 403)
    return prisma.lobby.update({
        where: { id },
        data,
        select: publicLobbySelect
    })
    
}

export const deleteLobbyService = async (id: string, userId: string, role: Role) => {
    const lobby = await prisma.lobby.findUnique({
        where: { id },
        select: {
            id: true,
            hostId : true
        }
    })
    
    if (!lobby) throw new AppError('Lobby not found', 404)
    if (lobby.hostId !== userId && role !== Role.ADMIN ) throw new AppError('Access Denied', 403)

    const deleteLobby = await prisma.lobby.delete({
        where: { id },
    })
    return deleteLobby

}