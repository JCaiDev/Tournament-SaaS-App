// Mirrors a Team row from the API (lobby-team routes). Tournament lobbies only.
export interface Team {
  id: string;
  lobbyId: string;
  name: string;
}

// POST /lobbies/:lobbyId/teams and PATCH /lobbies/:lobbyId/teams/:teamId
export interface TeamRequest {
  name: string;
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
