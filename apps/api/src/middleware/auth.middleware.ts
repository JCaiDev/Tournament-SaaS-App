import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AppError } from '../errors/AppErrors'
import { Role } from '@prisma/client'
 
export function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        // step 1: get the authorization header
        const authHeader = req.headers.authorization

        if (!authHeader) {
            return next(new AppError('Missing Authorization header', 401))
        }

        const [scheme, token] = authHeader.split(' ')
        if (scheme !== "Bearer" || !token) {
            return next(new AppError('Invalid Token', 401))
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string, role: Role }
        req.user = { id: payload.sub, role: payload.role }
        return next()
    } catch (error) {
        return next(new AppError("Invalid or expired token", 401))
    }
}

export function requireRole( ...allowedRoles: Role[]) {
        return (req: Request, res: Response, next: NextFunction) => {
            if (!req.user) {
                throw new AppError('Not Logged In', 401)
            }
            if (!allowedRoles.includes(req.user.role)) {
                throw new AppError('Not Authorized', 403)
            }
            next()
        }
}