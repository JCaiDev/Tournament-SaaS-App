import { prisma } from '../../src/prisma';
import { SkillLevel, GenderFormat } from '@prisma/client';

export function validLobbyBody(overrides: Record<string, unknown> = {}) {
    return {
        lobbyName: 'Sunday Intermediate Drop-In',
        location: 'WePlay Sports Dome',
        startTime: new Date(Date.now() + 60 * 60 * 1000), // +1h
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // +2h
        price: 10,
        skillLevel: SkillLevel.OPEN,
        genderFormat: GenderFormat.COED,
        allowToApply: true,
        ...overrides,
    };
}

// creates a real lobby row owned by hostId — perfect for the delete test's arrange
export async function seedLobby(hostId: string, overrides = {}) {
    return prisma.lobby.create({
        data: { ...validLobbyBody(), hostId, ...overrides },
    });
}

// creates a guest LobbyPlayer row directly in the DB, so PATCH/DELETE tests
// don't depend on the POST endpoint working
export async function seedGuest(lobbyId: string, guestName = 'Bob') {
    return prisma.lobbyPlayer.create({
        data: { lobbyId, guestName },
    });
}
