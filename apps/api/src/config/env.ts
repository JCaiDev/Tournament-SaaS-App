const requiredEnvVars = [
    "NODE_ENV",
    'DATABASE_URL',
    'GOOGLE_CLIENT_ID',
    'JWT_SECRET',
] as const;

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(
            `Missing required environment variable: ${envVar}`
        )
    }
}

export const ENV = {
    NODE_ENV: process.env.NODE_ENV!,
    DATABASE_URL: process.env.DATABASE_URL!,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
    JWT_SECRET: process.env.JWT_SECRET!,
}