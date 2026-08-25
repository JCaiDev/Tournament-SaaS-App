import type { GoogleLoginInput, LoginInput } from './auth.schemas'
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken'
import { verifyGoogleToken, findOrCreateGoogleUser, loginService } from './auth.service'
import { ENV } from '../config/env'

export async function googleLoginController(req: Request<{}, {}, GoogleLoginInput>, res: Response, next: NextFunction) {

    try {

        const { idToken } = req.validatedBody as GoogleLoginInput
        const claims = await verifyGoogleToken(idToken)
        const user = await findOrCreateGoogleUser(claims)
        const accessToken = jwt.sign(
            { sub: user.id, role: user.role },
            ENV.JWT_SECRET,
            { expiresIn: '15m' }
        )
        return res.status(200).json({ user, accessToken })

    } catch (error) {
        next(error)
    }

}

export async function loginController(req: Request<{}, {}, LoginInput>, res: Response, next: NextFunction ) {
    try {
        const {email, password} = req.validatedBody as LoginInput
        const user = await loginService(email, password)
        const accessToken = jwt.sign(
            { sub: user.id, role: user.role },
            ENV.JWT_SECRET,
            {expiresIn: '15m'}
        )
        return res.status(200).json({ user, accessToken})
    } catch (error) {
        next(error)
    }
}