import { z } from 'zod';
import { SkillLevel, LobbyFormat } from '@prisma/client';
import { GenderFormat } from '@prisma/client';

const lobbyBaseSchema = z.object({
    lobbyName: z.string().trim().min(3).max(50),
    location: z.string().trim().min(3),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    price: z.number().min(0),
    skillLevel: z.enum(SkillLevel),
    genderFormat: z.enum(GenderFormat),
    allowToApply: z.boolean(),
});

export const createLobbySchema = lobbyBaseSchema
    .extend({ format: z.enum(LobbyFormat) })
    .refine((d) => d.endTime > d.startTime, {
        message: 'End time must be after start time',
        path: ['endTime'],
    })
    .refine((d) => d.startTime > new Date(), {
        message: 'Start time cannot be in the past',
        path: ['startTime'],
    });

export const updateLobbySchema = lobbyBaseSchema.partial();

export type CreateLobbyInput = z.infer<typeof createLobbySchema>;
export type UpdateLobbyInput = z.infer<typeof updateLobbySchema>;

// The one rule for what a lobby id looks like; every lobby route param uses it.
export const lobbyIdSchema = z
    .string()
    .trim()
    .pipe(z.uuid('Invalid lobby ID format'));

export const lobbyParamSchema = z.object({
    id: lobbyIdSchema,
});

export const lobbyIdParamSchema = z.object({
    lobbyId: lobbyIdSchema,
});

export type LobbyParamInput = z.infer<typeof lobbyParamSchema>;
export type LobbyIdParamInput = z.infer<typeof lobbyIdParamSchema>;
