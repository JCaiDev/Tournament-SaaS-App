"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const validate_1 = require("./middleware/validate");
const app = (0, express_1.default)();
app.use(express_1.default.json());
const zod_1 = require("zod");
const createUserSchema = zod_1.z.object({
    name: zod_1.z.string(),
    age: zod_1.z.number()
});
const updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    age: zod_1.z.number().optional(),
});
const userQuerySchema = zod_1.z.object({
    active: zod_1.z
        .string()
        .optional()
        .transform(val => val === 'true'),
    minAge: zod_1.z
        .string()
        .optional()
        .transform(val => Number(val))
        .refine(val => isNaN(val), {
        message: "minAge must be a number",
    })
});
let nextId = 1;
let users = [];
// write a POST /users endpoint
app.post('/users', (0, validate_1.validateBody)(createUserSchema), (req, res) => {
    const { name, age } = req.body;
    const newUser = {
        id: nextId++,
        name,
        age,
        deletedAt: null
    };
    users.push(newUser);
    res.status(201).json({
        message: 'User Successfully Created',
        user: newUser
    });
});
app.put('/users/:id', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "Invald ID" });
    }
    const result = updateUserSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            error: "Invalid request body",
            details: result.error.issues
        });
    }
    const user = users.find(user => user.id === id && user.deletedAt === null);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    const { name, age } = result.data;
    if (name !== undefined) {
        user.name = name;
    }
    if (age !== undefined) {
        user.age = age;
    }
    res.status(200).json({
        message: 'Updated user successfully',
        user
    });
});
app.get('/users/:id', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid Id' });
    }
    const user = users.find(user => user.id === id);
    if (!user) {
        throw new AppErrors_1.AppError("User not found", 404);
    }
    res.status(200).json(user);
});
//Get Endpoint List
app.get('/users/', (req, res) => {
    const results = userQuerySchema.safeParse(req.query);
    if (!results.success) {
        return res.status(400).json({
            message: "Invalid query parameters",
            details: results.error.issues,
        });
    }
    const { active, minAge } = results.data;
    let filteredUsers = users;
    if (active !== undefined) {
        filteredUsers = filteredUsers.filter(user => (active ? user.deletedAt === null : user.deletedAt !== null));
    }
    if (minAge !== undefined) {
        filteredUsers = filteredUsers.filter(user => user.age >= minAge);
    }
    res.status(200).json(filteredUsers);
    throw new AppErrors_1.AppError("User not found", 404);
});
app.delete('/users/:id', (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id))
        return res.status(400).json({ error: "Invalid ID" });
    const user = users.find(user => user.id === id && user.deletedAt === null);
    if (!user || user.deletedAt !== null) {
        return res.status(404).json({ error: 'User does not exist.' });
    }
    //soft delete
    user.deletedAt = new Date();
    res.status(200).json({ message: "User deleted successfully" });
});
let port = 3001;
app.listen(port, () => {
    console.log(`server running on port ${port}`);
});
const errorHandler_1 = require("./middleware/errorHandler");
const AppErrors_1 = require("./errors/AppErrors");
app.use(errorHandler_1.errorHandler);
