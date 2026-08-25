import { OAuth2Client } from 'google-auth-library';
import { ENV } from '../config/env';
import { AppError } from '../errors/AppErrors';
import { googleUserPayloadSchema } from '../user/user.schemas'
import * as UserServices from '../user/user.services'
import type { GoogleUserPayload } from '../user/user.schemas'
import argon2 from 'argon2'

const client = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

export const verifyGoogleToken = async (idToken: string) => {
    const ticket = await client.verifyIdToken({
        idToken,
        audience: ENV.GOOGLE_CLIENT_ID
    })
    const payload = ticket.getPayload();
    if (payload === undefined) {
        throw new AppError('Invalid Google Token', 401)
    }

    const result = googleUserPayloadSchema.safeParse({
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        emailVerified: payload.email_verified,
    })

    if (!result.success) {
        throw new AppError("Invalid Google Token", 401)
    }

    return result.data
}

export const findOrCreateGoogleUser = async (claims: GoogleUserPayload) => {
    // finduserbygooglesub if exists return login
    const existingByGoogleSub = await UserServices.findUserByGoogleSub(claims.sub)
    if (existingByGoogleSub !== null) {
        return existingByGoogleSub
    }

    // finduserby email if not email verfieid reutrn 409 error
    const existingByEmail = await UserServices.findUserByEmail(claims.email)

    if (existingByEmail !== null) {
        if (claims.emailVerified !== true) {
            throw new AppError('Account Conflict - please login with email', 409)
        }
        if (existingByEmail.googleSub === null) {
            return UserServices.linkGoogleAccount(existingByEmail.id, claims.sub)
        }
        throw new AppError('Account Conflict - please login with email', 409)
    }

    // no matches no sub no email -> return create new account
    return UserServices.createGoogleUser(claims)
} 

export const loginService = async (email: string, password: string) => {
    const user = await UserServices.findUserForLogin(email)

    if (!user || user.passwordHash === null) {
        throw new AppError('Incorrect Login Credentials', 401)
    }

    const correctPassword = await argon2.verify(user.passwordHash, password)
    if (!correctPassword) throw new AppError ('Incorrect Login Credentials', 401)

    const { passwordHash, ...safeUser} = user
    return safeUser
}