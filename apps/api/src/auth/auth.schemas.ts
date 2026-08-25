import { z } from 'zod'

export const googleLoginSchema = z.object({
    idToken: z.string().trim().min(1)
})

export const loginSchema = z.object({
    email: z.string()
        .trim()
        .toLowerCase()
        .pipe(z.email()),
    password: z.string().min(1)
})

export type GoogleLoginInput = z.infer<typeof googleLoginSchema>
export type LoginInput = z.infer<typeof loginSchema>