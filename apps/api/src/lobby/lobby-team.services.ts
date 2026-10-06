import { AddTeamInput } from './lobby-team.schemas';
import { AuthUser } from '../types/auth';
import { assertLobbyManager } from './lobby-access';
import { prisma } from '../prisma';
import { AppError } from '../errors/AppErrors';
import { Prisma } from '@prisma/client';

export const addTeamService = async (
    lobbyId: string,
    actor: AuthUser,
    teamInput: AddTeamInput,
) => {
    await assertLobbyManager(lobbyId, actor);
    try {
        return await prisma.team.create({
            data: {
                lobbyId,
                name: teamInput.name,
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
