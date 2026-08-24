"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.pool = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
exports.pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new adapter_pg_1.PrismaPg(exports.pool);
exports.prisma = new client_1.PrismaClient({ adapter });
