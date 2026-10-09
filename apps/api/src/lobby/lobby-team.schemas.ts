import { z } from 'zod';
import { lobbyIdSchema } from './lobby.schemas';

export const addTeamSchema = z.object({
    name: z
        .string()
        .trim()
        .overwrite((s) => s.replace(/\s+/g, ' '))
        .min(1)
        .max(25),
    captainName: z
        .string()
        .trim()
        .overwrite((s) => s.replace(/\s+/g, ' '))
        .min(1)
        .max(25)
        .optional(),
});

export const updateTeamSchema = z
    .object({
        name: z
            .string()
            .trim()
            .overwrite((s) => s.replace(/\s+/g, ' '))
            .min(1)
            .max(25)
            .optional(),
        captainName: z
            .string()
            .trim()
            .overwrite((s) => s.replace(/\s+/g, ' '))
            .min(1)
            .max(25)
            .optional()
            .nullable(),
    })
    .refine(
        (data) => data.name !== undefined || data.captainName !== undefined,
        {
            message: 'Provide Team Name or Captain Name',
        },
    );

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
