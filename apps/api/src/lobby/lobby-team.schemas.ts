import { z } from 'zod';
import { lobbyIdSchema } from './lobby.schemas';

const MAX_SETS = 5;

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

export const courtModeSchema = z
    .enum(['ONE_POOL_PER_COURT', 'TAKE_TURNS', 'WAVES'])
    .default('WAVES');

export const generateScheduleSchema = z.object({
    courts: z.int().max(500).min(1),
    startTime: z.coerce.date().optional(),
    slotMinutes: z.int().min(20).max(240),
    courtMode: courtModeSchema,
    referees: z.boolean().default(false),
});

export const setPoolFormatSchema = z
    .object({
        poolSetMode: z.enum(['PLAY_ALL', 'BEST_OF']),
        poolSets: z.int().min(1).max(MAX_SETS),
    })
    .refine(
        (data) => {
            if (data.poolSetMode === 'BEST_OF') {
                return data.poolSets % 2 === 1;
            }
            return true;
        },
        { message: 'Best of needs an odd number of sets' },
    );

export const setScoreSchema = z.object({
    teamAPoints: z.int().min(0).max(99),
    teamBPoints: z.int().min(0).max(99),
});

export const setMatchSetsSchema = z.object({
    sets: z.array(setScoreSchema).max(MAX_SETS),
});

export type GenerateScheduleInput = z.infer<typeof generateScheduleSchema>;
export type AddTeamInput = z.infer<typeof addTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type TeamParamInput = z.infer<typeof teamParamSchema>;
export type SetSeedsInput = z.infer<typeof setSeedsSchema>;
export type SetPoolsInput = z.infer<typeof setPoolsSchema>;
export type SetPoolFormatInput = z.infer<typeof setPoolFormatSchema>;
export type SetMatchSetsInput = z.infer<typeof setMatchSetsSchema>;
