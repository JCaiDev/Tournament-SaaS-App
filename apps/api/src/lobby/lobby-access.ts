import { prisma } from '../prisma';
import { AppError } from '../errors/AppErrors';
import { Role } from '@prisma/client';
import { AuthUser } from './../types/auth';

export const assertLobbyManager = async (lobbyId: string, actor: AuthUser) => {
    const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        select: {
            organizerId: true,
            format: true,
        },
    });

    if (!lobby) throw new AppError('Lobby not found', 404);
    const isManager =
        lobby.organizerId === actor.id || actor.role === Role.ADMIN;
    if (!isManager) throw new AppError('Forbidden', 403);

    return lobby;
};
