import { prisma } from '../prisma';
import { Prisma, Role } from '@prisma/client'
import argon2 from 'argon2';
import { CreateUserInput, UpdateUserInput, GoogleUserPayload } from './user.schemas';
import { AppError } from '../errors/AppErrors';


export const publicUserSelect = {
    id: true,
    name: true,
    role: true,
    createdAt: true,
    pictureUrl: true,
} satisfies Prisma.UserSelect;

export const privateUserSelect = {
    id: true,
    email: true,
    name: true,
    birthDate: true,
    role: true,
    createdAt: true,
    updatedAt: true,
    pictureUrl: true,
} satisfies Prisma.UserSelect;

export const googleAuthUserSelect = {
    id: true,
    email: true,
    googleSub: true,
    deletedAt: true,
} satisfies Prisma.UserSelect;

export const loginAuthUserSelect = {
    id: true,
    email: true,
    name: true,
    createdAt: true,
    role: true,
    passwordHash: true,
} satisfies Prisma.UserSelect

export const createUser = async (data: CreateUserInput) => {
    const existingUser = await prisma.user.findUnique({
        where: { email: data.email }
    })

    if (existingUser) {
        throw new AppError('This email is already registered. Please log in with your email', 409)
    }

    const passwordHash = await argon2.hash(data.password);

    return await prisma.user.create({
        data: {
            email: data.email,
            passwordHash,
            name: data.name,
            birthDate: data.birthDate,
            role: Role.PLAYER,
        },
        select: privateUserSelect,
    });
};


export const getUserByIdService = async (id: string) => {
    const user = await prisma.user.findFirst({
        where: { id, deletedAt: null },
        select: publicUserSelect
    })
    if (!user) throw new AppError('User not found', 404)
    return user
}

export const updateUserService = async (id: string, updateData: UpdateUserInput) => {
    const user = await prisma.user.findFirst({
        where: { id, deletedAt: null }
    })
    if (!user) throw new AppError('User not found', 404)

    const { password, ...data } = updateData;
    let passwordHash: string | undefined;

    if (password) {
        passwordHash = await argon2.hash(password);
    }

    return await prisma.user.update({
        where: { id },
        data: {
            ...data,
            ...(passwordHash && { passwordHash }),
        },
        select: privateUserSelect,
    });
}

export const deleteUserService = async (id: string) => {
    const user = await prisma.user.findFirst({
        where: { id, deletedAt: null }
    })
    if (!user) throw new AppError('User not found', 404)

    return await prisma.user.update({
        where: { id },
        data: {
            deletedAt: new Date()
        },
        select: { id: true, email: true, name: true, deletedAt: true }
    })
}

export const findUserByGoogleSub = async (googleSub: string) => {
    return await prisma.user.findUnique({
        where: { googleSub },
        select: privateUserSelect,
    })
}

export const findUserByEmail = async (email: string) => {
    return await prisma.user.findUnique({
        where: { email },
        select: googleAuthUserSelect
    })
}

export const createGoogleUser = async (claims: GoogleUserPayload) => {
    return await prisma.user.create({
        data: {
            email: claims.email,
            name: claims.name,
            googleSub: claims.sub,
            pictureUrl: claims.picture,
        },
        select: privateUserSelect,
    })
}

export const linkGoogleAccount = async (id: string, googleSub: string) => {
    return await prisma.user.update({
        where: { id },
        data: { googleSub },
        select: privateUserSelect,
    })
}

export const findUserForLogin = async (email: string) => {
    return await prisma.user.findFirst({
        where: { email, deletedAt: null }, 
        select: loginAuthUserSelect
    })
}