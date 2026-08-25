import { ZodType } from "zod";
import { Request, Response, NextFunction } from 'express'
import { AppError } from "../errors/AppErrors";

export function validateBody(schema: ZodType) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body)

        if (!result.success) {
            throw new AppError("Invalid request body", 400)
        }
        req.validatedBody = result.data
        next()
    }
}

export function validateQuery(schema: ZodType) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.query)

        if (!result.success) {
            throw new AppError("Invalid query parameters", 400)
        }
        req.validatedQuery = result.data

        next()
    }
}

export function validateParams(schema: ZodType) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.params)
        if (!result.success) {
            throw new AppError("Invalid route parameters", 400)
        }

        req.validatedParams = result.data
        next()
    }
}