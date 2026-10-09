// Mirrors a Team row from the API (lobby-team routes). Tournament lobbies only.
export interface Team {
  id: string;
  lobbyId: string;
  name: string;
  captainName: string | null; // null = no captain entered
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
