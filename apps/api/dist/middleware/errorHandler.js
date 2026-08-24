"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const AppErrors_1 = require("../errors/AppErrors");
function errorHandler(err, req, res, next) {
    if (err instanceof AppErrors_1.AppError) {
        return res.status(err.statusCode).json({
            error: {
                message: err.message,
                statusCode: err.statusCode
            }
        });
    }
    console.error(err);
    return res.status(500).json({
        error: "Internal server error",
        statusCode: 500,
    });
}
