import { z } from 'zod';
import { lobbyIdSchema } from './lobby.schemas';

export const addLobbyPlayerSchema = z
    .object({
        userId: z.uuid().optional(),
        guestName: z.string().trim().min(1).optional(),
        position: z.string().optional(),
    })
    .refine((data) => data.userId || data.guestName, {
        message: 'Must provide either userId or guestName is required',
        path: ['userId'],
    });

export const lobbyPlayerParamSchema = z.object({
    lobbyId: lobbyIdSchema,
    playerId: z.uuid(),
});

export const updatePlayerSchema = z.object({
    guestName: z.string().trim().min(1).optional(),
    approved: z.boolean().optional(),
    paid: z.boolean().optional(),
    position: z.string().optional(),
});

export type AddPlayerInput = z.infer<typeof addLobbyPlayerSchema>;
export type LobbyPlayerParamInput = z.infer<typeof lobbyPlayerParamSchema>;
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;
