import { prisma } from '../../src/prisma'

let userCounter = 0

export async function seedUser( data?: {
    name?:string,
    birthDate?: Date,
    deletedAt?: Date | null,
    email?: string,
    passwordHash?: string | null,
}) {

    return prisma.user.create({
        data: {
            name: data?.name ?? 'Alison',
            birthDate: data?.birthDate ?? new Date(),
            deletedAt: data?.deletedAt ?? null,
            email: data?.email ?? `user${++userCounter}@app.ca`,
            passwordHash: data?.passwordHash === undefined ? 'hashedPassword' : data.passwordHash,
        }
    })
}
