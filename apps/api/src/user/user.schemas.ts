import { z } from 'zod';
import { Role } from '@prisma/client';

export const createUserSchema = z.object({
    email: z.string().toLowerCase().trim().pipe(z.email()),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters long')
        .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least 1 lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least 1 number')
        .regex(/[^a-zA-Z0-9]/, 'Password must contain at least 1 special character'),
    name: z.string().trim(),
    birthDate: z.coerce.date(),
}).strict();

export const userParamSchema = z.object({
    id: z.string().trim().pipe(z.uuid('Invalid user ID format')),
})

export const updateUserSchema = createUserSchema.pick({
    name: true,
    birthDate: true,
    password: true,
    email: true,
}).partial();

export const googleUserPayloadSchema = z.object({
    sub: z.string().trim().min(1),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    name: z.string().trim().min(1),
    emailVerified: z.boolean(),
    picture: z.string().trim().pipe(z.url()).optional(),
})


export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UserParamInput = z.infer<typeof userParamSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type GoogleUserPayload = z.infer<typeof googleUserPayloadSchema>;