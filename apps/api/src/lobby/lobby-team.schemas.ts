import { z } from 'zod';
import { lobbyIdSchema } from './lobby.schemas';

export const addTeamSchema = z.object({
    name: z
        .string()
        .trim()
        .overwrite((s) => s.replace(/\s+/g, ' '))
        .min(1)
        .max(50),
});

export const updateTeamSchema = z.object({
    name: z
        .string()
        .trim()
        .overwrite((s) => s.replace(/\s+/g, ' '))
        .min(1)
        .max(50),
});

export const teamIdSchema = z
    .string()
    .trim()
    .pipe(z.uuid('Invalid team ID format'));

export const teamParamSchema = z.object({
    lobbyId: lobbyIdSchema,
    teamId: teamIdSchema,
});

export type AddTeamInput = z.infer<typeof addTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type TeamParamInput = z.infer<typeof teamParamSchema>;
