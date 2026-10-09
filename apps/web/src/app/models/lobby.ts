// Mirrors the backend `publicLobbySelect` shape returned by GET /lobbies and
// GET /lobbies/:id. Dates arrive as ISO strings over JSON.

export type SkillLevel = 'OPEN' | 'INTERMEDIATE' | 'INTERMEDIATE_PLUS';
export type GenderFormat = 'MENS' | 'WOMENS' | 'COED';
export type Role = 'ADMIN' | 'ORGANIZER' | 'PLAYER';
// Set once when the lobby is created; the API ignores it on update.
export type LobbyFormat = 'PICKUP' | 'TOURNAMENT';

// Mirrors the API's ORGANIZER_ROLES: who may create and manage lobbies.
// Display only; the API enforces it.
export const ORGANIZER_ROLES: readonly Role[] = ['ADMIN', 'ORGANIZER'];

export interface PublicUser {
  id: string;
  name: string;
  role: Role;
  createdAt: string;
  pictureUrl: string | null;
}

export interface Lobby {
  id: string;
  lobbyName: string;
  location: string;
  startTime: string;
  endTime: string;
  price: number;
  skillLevel: SkillLevel;
  genderFormat: GenderFormat;
  allowToApply: boolean;
  format: LobbyFormat;
  // Max players on the active roster; null means no cap (unlimited).
  capacity: number | null;
  createdAt: string;
  organizer: PublicUser;
}

// Response envelopes from the API
export interface LobbyListResponse {
  success: boolean;
  lobbies: Lobby[];
}

export interface LobbyDetailResponse {
  success: boolean;
  lobby: Lobby;
}

export interface CreateLobbyRequest {
  lobbyName: string;
  location: string;
  startTime: string;   // ISO-ish string; backend coerces to Date
  endTime: string;
  price: number;
  skillLevel: SkillLevel;
  genderFormat: GenderFormat;
  allowToApply: boolean;
  format: LobbyFormat; // required by POST /lobbies
  capacity: number | null;
}

export const SKILL_LABELS: Record<SkillLevel, string> = {
  OPEN: 'Open',
  INTERMEDIATE: 'Intermediate',
  INTERMEDIATE_PLUS: 'Intermediate+',
};

export const GENDER_LABELS: Record<GenderFormat, string> = {
  MENS: "Men's",
  WOMENS: "Women's",
  COED: 'Co-ed',
};

// format can't change after creation, so it isn't part of an update.
export type UpdateLobbyRequest = Partial<Omit<CreateLobbyRequest, 'format'>>;

// ---- Lobby players ----

// The trimmed user shape the backend attaches to a player via `include.user`.
export interface LobbyPlayerUser {
  id: string;
  name: string;
  pictureUrl: string | null;
}

// Mirrors a LobbyPlayer row. Guests have userId/user null and a guestName.
export interface LobbyPlayer {
  id: string;
  lobbyId: string;
  userId: string | null;
  guestName: string | null;
  position: string;
  approved: boolean;
  paid: boolean;
  joinedAt: string;
  user: LobbyPlayerUser | null;
}

// POST /lobbies/:lobbyId/players — provide either userId or guestName.
export interface AddPlayerRequest {
  userId?: string;
  guestName?: string;
  position?: string;
}

// PATCH /lobbies/:lobbyId/players/:playerId — all optional.
export interface UpdatePlayerRequest {
  guestName?: string;
  approved?: boolean;
  paid?: boolean;
  position?: string;
}

export interface LobbyPlayerListResponse {
  success: boolean;
  players: LobbyPlayer[];
}

export interface LobbyPlayerResponse {
  message: string;
  player: LobbyPlayer;
}
