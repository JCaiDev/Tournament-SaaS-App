import { Request, Response, NextFunction } from 'express';
import * as UserServices from './user.services';
import { CreateUserInput, UserParamInput, UpdateUserInput } from './user.schemas'
import { AppError } from '../errors/AppErrors'

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userData = req.validatedBody as CreateUserInput;
        const user = await UserServices.createUser(userData);

        res.status(201).json({ message: 'User succesfully created', user });
    } catch (error) {
        next(error)
    }
}

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.validatedParams as UserParamInput
        const user = await UserServices.getUserByIdService(id)

        res.status(200).json({ success: true, user })
    } catch (error) {
        next(error)
    }
}

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return next(new AppError('Unauthorized', 401))
        }
        const { id } = req.user
        const updatedData = req.validatedBody as UpdateUserInput
        const updatedUser = await UserServices.updateUserService(id, updatedData)

        res.status(200).json({ success: true, updatedUser })
    } catch (error) {
        next(error)
    }
}

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return next(new AppError('Unauthorized', 401))
        }
        const { id } = req.user
        const deletedUser = await UserServices.deleteUserService(id)
        res.status(200).json({
            success: true,
            message: "User Successfully Deleted",
            deletedUser
        })
    } catch (error) {
        next(error)
    }
}

export const updateUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        
        const { id } = req.validatedParams as UserParamInput
        const updatedData = req.validatedBody  as UpdateUserInput
        const updatedUser = await UserServices.updateUserService(id, updatedData) 
        
        res.status(200).json({ message:"User updated successfully", updatedUser })
    } catch (error) {
        next(error)
    }
}

export const deleteUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.validatedParams as UserParamInput
        const deletedUser = await UserServices.deleteUserService(id)
        res.status(200).json({
            success: true,
            message: "User Successfully Deleted",
            deletedUser
        })
    } catch (error) {
        next(error)
    }
}