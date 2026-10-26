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
