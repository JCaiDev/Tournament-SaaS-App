// Mirrors a Team row from the API (lobby-team routes). Tournament lobbies only.
export interface Team {
  id: string;
  lobbyId: string;
  name: string;
  captainName: string | null; // null = no captain entered
  seed: number | null; // 1 = top seed; null = unseeded
  poolId: string | null; // null = Unassigned
}

// POST /lobbies/:lobbyId/teams — captain is optional.
export interface AddTeamRequest {
  name: string;
  captainName?: string;
}

// PATCH /lobbies/:lobbyId/teams/:teamId — send only what changed.
// A missing field is left alone; captainName: null removes the captain.
export interface UpdateTeamRequest {
  name?: string;
  captainName?: string | null;
}

// GET /lobbies/:lobbyId/teams — sorted by name
export interface TeamListResponse {
  message: string;
  teams: Team[];
}

// POST (201) and PATCH (200) both return the saved team.
export interface TeamResponse {
  message: string;
  team: Team;
}

// PUT /lobbies/:lobbyId/teams/seeds — only the seeded teams, best first.
// Every team left out becomes unseeded; [] clears all seeds.
export interface SetSeedsRequest {
  teamIds: string[];
}

// A Pool row with its teams, as GET and PUT /lobbies/:lobbyId/pools return it.
// Pools are sorted by name; the teams inside a pool are in no set order.
export interface Pool {
  id: string;
  lobbyId: string;
  name: string;
  teams: Team[];
}

// One pool in the layout the organizer saves. Teams in no pool are Unassigned.
export interface PoolLayout {
  name: string;
  teamIds: string[];
}

// PUT /lobbies/:lobbyId/pools — the whole layout, every time (full replace).
export interface SetPoolsRequest {
  pools: PoolLayout[];
}

export interface PoolListResponse {
  message: string;
  pools: Pool[];
}

// A Match row, as POST and GET /lobbies/:lobbyId/schedule return it.
// The API stores only the planned start; a match ends at startTime + the
// lobby's slot length (endTime is derived, never stored).
export interface Match {
  id: string;
  lobbyId: string;
  poolId: string;
  teamAId: string;
  teamBId: string;
  // The team reffing this match. null = refs were off, or no team was free
  // in that slot (a "ref gap": the organizer covers it).
  refTeamId: string | null;
  court: number; // 1-based label
  startTime: string; // ISO
}

// How pools share the courts (the API's courtMode):
// - TAKE_TURNS: every pool plays a round, then the next pool's round…
// - WAVES: all of Pool A, then all of Pool B (the API default).
// - ONE_POOL_PER_COURT: Pool A on court 1, Pool B on court 2… needs
//   courts === pools, otherwise the API answers 409.
export type CourtMode = 'TAKE_TURNS' | 'WAVES' | 'ONE_POOL_PER_COURT';

// POST /lobbies/:lobbyId/schedule. startTime is optional: the API falls back
// to the lobby's start time. courtMode defaults to WAVES and referees to
// false on the API, so older clients keep their behaviour.
export interface GenerateScheduleRequest {
  courts: number; // 1–500
  slotMinutes: number; // 20–240
  startTime?: string; // ISO
  courtMode?: CourtMode;
  referees?: boolean; // a team sitting out refs each match
}

// Both schedule endpoints: matches sorted by start time, then court.
export interface ScheduleResponse {
  message: string;
  schedule: Match[];
}
