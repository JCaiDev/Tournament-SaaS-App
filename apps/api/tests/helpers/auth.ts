import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'

export function makeAuthHeader(userId: string, role: Role = Role.PLAYER) {
    const secret = process.env.JWT_SECRET
    if (!secret) {
        throw new Error('JWT_SECRET is not set')
    }

    const token = jwt.sign({ sub: userId, role }, secret, { expiresIn: '15m' })
    return `Bearer ${token}`
}
