import {
    AddTeamInput,
    SetPoolsInput,
    SetSeedsInput,
    UpdateTeamInput,
} from './lobby-team.schemas';
import { AuthUser } from '../types/auth';
import { assertLobbyManager } from './lobby-access';
import { prisma } from '../prisma';
import { AppError } from '../errors/AppErrors';
import { Prisma, LobbyFormat } from '@prisma/client';

export const addTeamService = async (
    lobbyId: string,
    actor: AuthUser,
    teamInput: AddTeamInput,
) => {
    const lobby = await assertLobbyManager(lobbyId, actor);

    if (lobby.format !== LobbyFormat.TOURNAMENT)
        throw new AppError('Teams can only be added to tournaments', 409);
    try {
        return await prisma.team.create({
            data: {
                lobbyId,
                name: teamInput.name,
                captainName: teamInput.captainName,
            },
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            throw new AppError('A team with that name already exists', 409);
        }
        throw error;
    }
};

export const listTeamsService = async (lobbyId: string) => {
    const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
    });
    if (!lobby) throw new AppError('Lobby not found', 404);

    const teams = await prisma.team.findMany({
        where: { lobbyId },
        orderBy: { name: 'asc' },
    });

    return teams;
};

export const updateTeamService = async (
    lobbyId: string,
    actor: AuthUser,
    teamId: string,
    teamInput: UpdateTeamInput,
) => {
    await assertLobbyManager(lobbyId, actor);

    try {
        return await prisma.team.update({
            where: { id: teamId, lobbyId },
            data: { name: teamInput.name, captainName: teamInput.captainName },
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002')
                throw new AppError('A team with that name already exists', 409);
            if (error.code === 'P2025')
                throw new AppError('Team not found', 404);
        }
        throw error;
    }
};

export const deleteTeamService = async (
    lobbyId: string,
    actor: AuthUser,
    teamId: string,
) => {
    await assertLobbyManager(lobbyId, actor);

    try {
        await prisma.team.delete({
            where: { id: teamId, lobbyId },
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025')
                throw new AppError('Team not found', 404);
        }
        throw error;
    }
};

export const setSeedsService = async (
    lobbyId: string,
    actor: AuthUser,
    teamInput: SetSeedsInput,
) => {
    const lobby = await assertLobbyManager(lobbyId, actor);
    if (lobby.format !== LobbyFormat.TOURNAMENT)
        throw new AppError('Seeding only available for tournaments', 409);
    const teamCount = await prisma.team.count({
        where: { lobbyId, id: { in: teamInput.teamIds } },
    });
    if (teamCount !== teamInput.teamIds.length) {
        throw new AppError('Team not found', 404);
    }
    await prisma.$transaction([
        prisma.team.updateMany({
            where: { lobbyId },
            data: { seed: null },
        }),
        ...teamInput.teamIds.map((teamId, index) =>
            prisma.team.update({
                where: { id: teamId, lobbyId },
                data: { seed: index + 1 },
            }),
        ),
    ]);
    return prisma.team.findMany({
        where: { lobbyId },
        orderBy: [{ seed: 'asc' }, { name: 'asc' }],
    });
};

export const setPoolsService = async (
    lobbyId: string,
    actor: AuthUser,
    poolInput: SetPoolsInput,
) => {
    const lobby = await assertLobbyManager(lobbyId, actor);
    if (lobby.format !== LobbyFormat.TOURNAMENT)
        throw new AppError('Pools are only available for tournaments', 409);
    const teamIds = poolInput.pools.flatMap((pool) => pool.teamIds);

    const teamCount = await prisma.team.count({
        where: {
            lobbyId,
            id: { in: teamIds },
        },
    });
    if (teamCount !== teamIds.length) throw new AppError('Team not found', 404);

    await prisma.$transaction([
        prisma.pool.deleteMany({
            where: { lobbyId },
        }),
        ...poolInput.pools.map((pool) =>
            prisma.pool.create({
                data: {
                    name: pool.name,
                    lobbyId,
                    teams: {
                        connect: pool.teamIds.map((teamId) => ({ id: teamId })),
                    },
                },
            }),
        ),
    ]);
    return prisma.pool.findMany({
        where: { lobbyId },
        include: { teams: true },
        orderBy: { name: 'asc' },
    });
};
