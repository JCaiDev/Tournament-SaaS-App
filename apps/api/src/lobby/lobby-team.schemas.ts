import { z } from 'zod';

export const addTeamSchema = z.object({
    name: z
        .string()
        .trim()
        .overwrite((s) => s.replace(/\s+/g, ' '))
        .min(1)
        .max(50),
});

export type AddTeamInput = z.infer<typeof addTeamSchema>;
