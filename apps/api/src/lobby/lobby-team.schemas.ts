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

export const setSeedsSchema = z.object({
    teamIds: z
        .array(teamIdSchema)
        .refine((ids) => new Set(ids).size === ids.length, {
            message: 'Each team can only appear once',
        }),
});

export const poolSchema = z.object({
    name: z.string().trim().min(1).max(25),
    teamIds: z.array(teamIdSchema),
});

export const setPoolsSchema = z.object({
    pools: z
        .array(poolSchema)
        .refine(
            (pools) => {
                const names = pools.map((pool) => pool.name);
                return new Set(names).size === names.length;
            },
            { message: 'Pool names must be unique' },
        )
        .refine(
            (pools) => {
                const teamIds = pools.flatMap((pool) => pool.teamIds);
                return new Set(teamIds).size === teamIds.length;
            },
            { message: 'Team can only be in one pool' },
        ),
});

export type AddTeamInput = z.infer<typeof addTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type TeamParamInput = z.infer<typeof teamParamSchema>;
export type SetSeedsInput = z.infer<typeof setSeedsSchema>;
export type SetPoolsInput = z.infer<typeof setPoolsSchema>;
