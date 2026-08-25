import { prisma } from "../../src/prisma";
import { closeQueues } from "./queue";

export async function resetDb(){
    // Delete child rows before parents to satisfy foreign keys.
    // Lobby.hostId -> User has no onDelete cascade, so lobbies must go first.
    // (RefreshToken cascades on user delete, so it doesn't need its own call.)
    await prisma.lobby.deleteMany()
    await prisma.user.deleteMany()
}

export async function disconnectDb(){
    await prisma.$disconnect()
    await closeQueues()
}

