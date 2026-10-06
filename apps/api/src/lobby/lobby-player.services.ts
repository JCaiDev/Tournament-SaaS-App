import { prisma } from '../prisma';
import { AppError } from '../errors/AppErrors';
import { Prisma } from '@prisma/client';
import { AddPlayerInput, UpdatePlayerInput } from './lobby-player.schemas';
import { AuthUser } from './../types/auth';
import { assertLobbyManager } from './lobby-access';

export const assertPlayerInLobby = async (
    lobbyId: string,
    playerId: string,
) => {
    const player = await prisma.lobbyPlayer.findUnique({
        where: { id: playerId },
        select: { lobbyId: true },
    });
    if (!player || player.lobbyId !== lobbyId)
        throw new AppError('Player not found', 404);
};

export const addLobbyPlayerService = async (
    lobbyId: string,
    actor: AuthUser,
    playerInput: AddPlayerInput,
) => {
    await assertLobbyManager(lobbyId, actor);

    try {
        return await prisma.lobbyPlayer.create({
            data: {
                lobbyId,
                userId: playerInput.userId ?? null,
                guestName: playerInput.guestName ?? null,
                position: playerInput.position ?? '',
            },
            include: {
                user: { select: { id: true, name: true, pictureUrl: true } },
            },
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            throw new AppError('Player is already in this lobby', 409);
        }
        throw error;
    }
};

export const getLobbyPlayersService = async (lobbyId: string) => {
    return prisma.lobbyPlayer.findMany({
        where: { lobbyId },
        orderBy: { joinedAt: 'asc' },
        include: {
            user: {
                select: { id: true, name: true, pictureUrl: true },
            },
        },
    });
};

export const updateLobbyPlayerService = async (
    lobbyId: string,
    playerId: string,
    actor: AuthUser,
    data: UpdatePlayerInput,
) => {
    await assertLobbyManager(lobbyId, actor);
    await assertPlayerInLobby(lobbyId, playerId);

    return prisma.lobbyPlayer.update({
        where: { id: playerId },
        data,
        include: {
            user: { select: { id: true, name: true, pictureUrl: true } },
        },
    });
};

export const removeLobbyPlayerService = async (
    lobbyId: string,
    playerId: string,
    actor: AuthUser,
) => {
    await assertLobbyManager(lobbyId, actor);
    await assertPlayerInLobby(lobbyId, playerId);
    return prisma.lobbyPlayer.delete({
        where: { id: playerId },
    });
};
