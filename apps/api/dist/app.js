"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const validate_1 = require("./middleware/validate");
const errorHandler_1 = require("./middleware/errorHandler");
const AppErrors_1 = require("./errors/AppErrors");
require("dotenv/config");
const prisma_1 = require("./prisma");
exports.app = (0, express_1.default)();
exports.app.use(express_1.default.json());
// Zod Schemas =======================================
const createUserSchema = zod_1.z.object({
    name: zod_1.z.string(),
    age: zod_1.z.number()
});
const updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    age: zod_1.z.number().optional(),
})
    .refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
const userParamSchema = zod_1.z.object({
    id: zod_1.z
        .string()
        .regex(/^\d+$/, 'id must be a number')
});
const userQuerySchema = zod_1.z.object({
    active: zod_1.z.preprocess(val => {
        if (val === undefined)
            return undefined;
        return val === 'true';
    }, zod_1.z.boolean().optional()),
    minAge: zod_1.z
        .coerce.number()
        .optional()
});
// Routes ==========================================
// Create User
exports.app.post('/users', (0, validate_1.validateBody)(createUserSchema), async (req, res) => {
    const { name, age } = req.validatedBody;
    const user = await prisma_1.prisma.user.create({
        data: {
            name,
            age,
        }
    });
    res.status(201).json({
        message: 'User Successfully Created',
        user,
    });
});
// List Users
exports.app.get('/users/', (0, validate_1.validateQuery)(userQuerySchema), async (req, res) => {
    const { active, minAge } = req.validatedQuery;
    const where = {};
    if (active === true) {
        where.deletedAt = null;
    }
    if (active === false) {
        where.deletedAt = { not: null };
    }
    if (minAge !== undefined) {
        where.age = { gte: minAge };
    }
    const users = await prisma_1.prisma.user.findMany({
        where,
        orderBy: { id: 'asc' },
    });
    res.status(200).json({ users });
});
// Get User
exports.app.get('/users/:id', (0, validate_1.validateParams)(userParamSchema), async (req, res) => {
    const { id } = req.validatedParams;
    const numericId = Number(id);
    const user = await prisma_1.prisma.user.findFirst({
        where: {
            id: numericId,
            deletedAt: null
        }
    });
    if (!user) {
        throw new AppErrors_1.AppError("User not found", 404);
    }
    res.status(200).json({ user });
});
// Update User
exports.app.put('/users/:id', (0, validate_1.validateParams)(userParamSchema), (0, validate_1.validateBody)(updateUserSchema), async (req, res) => {
    const { id } = req.validatedParams;
    const numericID = Number(id);
    const { name, age } = req.validatedBody;
    const existingUser = await prisma_1.prisma.user.findFirst({
        where: {
            id: numericID,
            deletedAt: null,
        },
    });
    if (!existingUser) {
        throw new AppErrors_1.AppError('User not found', 404);
    }
    const updatedUser = await prisma_1.prisma.user.update({
        where: { id: numericID },
        data: {
            ...(name !== undefined && { name }),
            ...(age !== undefined && { age })
        }
    });
    res.status(200).json({
        message: "Updated User Successfully",
        user: updatedUser,
    });
});
// delete user
exports.app.delete('/users/:id', (0, validate_1.validateParams)(userParamSchema), async (req, res) => {
    const { id } = req.validatedParams;
    const numericId = Number(id);
    try {
        const user = await prisma_1.prisma.user.update({
            where: {
                id: numericId,
                deletedAt: null,
            },
            data: {
                deletedAt: new Date()
            }
        });
        res.status(200).json({ message: "User deleted successfully" });
    }
    catch (error) {
        throw new AppErrors_1.AppError('User does not exist', 404);
    }
});
exports.app.use(errorHandler_1.errorHandler);
