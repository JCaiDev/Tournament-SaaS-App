import 'dotenv/config'
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import authRoutes from './auth/auth.routes';
import userRoutes from './user/user.routes';
import healthRoutes from './health/health.routes';
import lobbyRoutes from './lobby/lobby.routes';
import lobbyPlayerRoutes from './lobby/lobby-player.routes';
import { errorHandler } from './middleware/errorHandler';


export const app = express();

// Global Middleware
app.use(cors({
    origin: 'http://localhost:4200',
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/health', healthRoutes);
app.use('/users', userRoutes);
app.use('/auth', authRoutes)
app.use('/lobbies', lobbyRoutes)
app.use('/lobbies', lobbyPlayerRoutes)

// Error handler should be the last middleware
app.use(errorHandler)