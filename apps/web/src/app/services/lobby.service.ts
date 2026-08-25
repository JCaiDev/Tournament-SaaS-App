import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Lobby,
  LobbyDetailResponse,
  LobbyListResponse,
  CreateLobbyRequest,
  UpdateLobbyRequest,
  LobbyPlayer,
  LobbyPlayerListResponse,
  LobbyPlayerResponse,
  AddPlayerRequest,
  UpdatePlayerRequest,
} from '../models/lobby';
import { MockLobbyApi } from '../shared/mock/mock-lobby.api';

@Injectable({ providedIn: 'root' })
export class LobbyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/lobbies`;

  // Dev-only in-memory backend (see environment.mockApi).
  private readonly useMock = environment.mockApi;
  private readonly mock = inject(MockLobbyApi);

  constructor() {
    if (this.useMock) this.mock.ensureDemoSession();
  }

  /** POST /lobbies - HOST/ADMIN only (enforced by backend) */
  createLobby(data: CreateLobbyRequest) : Observable<Lobby> {
    if (this.useMock) return this.mock.createLobby(data);
    return this.http
      .post<{ message: string; lobby: Lobby }>(this.baseUrl, data)
      .pipe(map((res) => res.lobby))
  }

  /** GET /lobbies — active lobbies (endTime in the future), soonest first. */
  listLobbies(): Observable<Lobby[]> {
    if (this.useMock) return this.mock.listLobbies();
    return this.http
      .get<LobbyListResponse>(this.baseUrl)
      .pipe(map((res) => res.lobbies));
  }

  /** GET /lobbies/:id — full detail for a single lobby. */
  getLobby(id: string): Observable<Lobby> {
    if (this.useMock) return this.mock.getLobby(id);
    return this.http
      .get<LobbyDetailResponse>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.lobby));
  }
  
  updateLobby(id: string, data: UpdateLobbyRequest): Observable<Lobby> {
  if (this.useMock) return this.mock.updateLobby(id, data);
  return this.http
    .patch<{ message: string; lobby: Lobby }>(`${this.baseUrl}/${id}`, data)
    .pipe(map((res) => res.lobby));
  }

  /** DELETE /lobbies/:id - owner or admin only (enforced by backend) */
  deleteLobby(id:string): Observable<void> {
    if (this.useMock) return this.mock.deleteLobby(id);
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** GET /lobbies/:lobbyId/players — public roster for a lobby. */
  listLobbyPlayers(lobbyId: string): Observable<LobbyPlayer[]> {
    if (this.useMock) return this.mock.listLobbyPlayers(lobbyId);
    return this.http
      .get<LobbyPlayerListResponse>(`${this.baseUrl}/${lobbyId}/players`)
      .pipe(map((res) => res.players));
  }

  /** POST /lobbies/:lobbyId/players — HOST/ADMIN only (enforced by backend). */
  addLobbyPlayer(lobbyId: string, data: AddPlayerRequest): Observable<LobbyPlayer> {
    if (this.useMock) return this.mock.addLobbyPlayer(lobbyId, data);
    return this.http
      .post<LobbyPlayerResponse>(`${this.baseUrl}/${lobbyId}/players`, data)
      .pipe(map((res) => res.player));
  }

  /** PATCH /lobbies/:lobbyId/players/:playerId — HOST/ADMIN only. */
  updateLobbyPlayer(
    lobbyId: string,
    playerId: string,
    data: UpdatePlayerRequest,
  ): Observable<LobbyPlayer> {
    if (this.useMock) return this.mock.updateLobbyPlayer(lobbyId, playerId, data);
    return this.http
      .patch<LobbyPlayerResponse>(`${this.baseUrl}/${lobbyId}/players/${playerId}`, data)
      .pipe(map((res) => res.player));
  }

  /** DELETE /lobbies/:lobbyId/players/:playerId — HOST/ADMIN only. */
  removeLobbyPlayer(lobbyId: string, playerId: string): Observable<void> {
    if (this.useMock) return this.mock.removeLobbyPlayer(lobbyId, playerId);
    return this.http.delete<void>(`${this.baseUrl}/${lobbyId}/players/${playerId}`);
  }
}
