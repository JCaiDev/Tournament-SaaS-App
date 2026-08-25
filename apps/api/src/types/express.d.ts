import 'express'
import type { AuthUser } from './auth'
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser
            validatedBody?: unknown
            validatedQuery?: unknown
            validatedParams?: unknown
        }
    }
}

