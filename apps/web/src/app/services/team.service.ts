import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Team, TeamListResponse, TeamRequest, TeamResponse } from '../models/team';

// Talks to the tournament team endpoints. Writes are organizer/admin only and
// the API also checks the caller organizes *that* lobby; the UI just hides the buttons.
// No mock backend: these need the real API (environment.mockApi is off).
@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/lobbies`;

  /** GET /lobbies/:lobbyId/teams — any signed-in user. */
  listTeams(lobbyId: string): Observable<Team[]> {
    return this.http
      .get<TeamListResponse>(`${this.baseUrl}/${lobbyId}/teams`)
      .pipe(map((res) => res.teams));
  }

  /** POST /lobbies/:lobbyId/teams — 409 if the name is taken in this lobby. */
  addTeam(lobbyId: string, data: TeamRequest): Observable<Team> {
    return this.http
      .post<TeamResponse>(`${this.baseUrl}/${lobbyId}/teams`, data)
      .pipe(map((res) => res.team));
  }

  /** PATCH /lobbies/:lobbyId/teams/:teamId — rename; 404 if the team isn't in this lobby. */
  renameTeam(lobbyId: string, teamId: string, data: TeamRequest): Observable<Team> {
    return this.http
      .patch<TeamResponse>(`${this.baseUrl}/${lobbyId}/teams/${teamId}`, data)
      .pipe(map((res) => res.team));
  }

  /** DELETE /lobbies/:lobbyId/teams/:teamId — 204; its roster entries become free agents. */
  deleteTeam(lobbyId: string, teamId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${lobbyId}/teams/${teamId}`);
  }
}
