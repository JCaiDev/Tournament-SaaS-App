import { Role } from '@prisma/client'

export type AuthUser = {
    id: string
    role: Role
}