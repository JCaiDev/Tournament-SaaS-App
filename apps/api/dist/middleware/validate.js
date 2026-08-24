"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
exports.validateQuery = validateQuery;
exports.validateParams = validateParams;
const AppErrors_1 = require("../errors/AppErrors");
function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            throw new AppErrors_1.AppError("Invalid request body", 400);
        }
        req.validatedBody = result.data;
        next();
    };
}
function validateQuery(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            throw new AppErrors_1.AppError("Invalid query parameters", 400);
        }
        req.validatedQuery = result.data;
        next();
    };
}
function validateParams(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            throw new AppErrors_1.AppError("Invalid route parameters", 400);
        }
        req.validatedParams = result.data;
        next();
    };
}
