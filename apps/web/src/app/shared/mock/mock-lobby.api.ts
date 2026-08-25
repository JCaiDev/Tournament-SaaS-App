import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  AddPlayerRequest,
  CreateLobbyRequest,
  Lobby,
  LobbyPlayer,
  PublicUser,
  UpdateLobbyRequest,
  UpdatePlayerRequest,
} from '../../models/lobby';
import { AuthService } from '../../services/auth.service';

// Dev-only fallback "host" used when nobody is signed in, so host tools show.
const MOCK_HOST: PublicUser = {
  id: 'mock-host',
  name: 'You (demo host)',
  role: 'HOST',
  createdAt: new Date().toISOString(),
  pictureUrl: null,
};

const LATENCY_MS = 150;

/**
 * In-memory stand-in for the lobby/player API. Active only when
 * environment.mockApi is true. Lets the whole UI run with no backend.
 */
@Injectable({ providedIn: 'root' })
export class MockLobbyApi {
  private readonly auth = inject(AuthService);

  private lobbies: Lobby[] = seedLobbies();
  private players: LobbyPlayer[] = seedPlayers();

  // Sign the visitor in as the demo host (only if nobody is already signed in)
  // so the host-only roster controls are visible in the demo.
  ensureDemoSession(): void {
    if (this.auth.currentUser()) return;
    this.auth.currentUser.set({
      id: MOCK_HOST.id,
      email: 'demo@example.com',
      name: MOCK_HOST.name,
      birthDate: null,
      role: MOCK_HOST.role,
      createdAt: MOCK_HOST.createdAt,
      updatedAt: MOCK_HOST.createdAt,
      pictureUrl: null,
    });
  }

  listLobbies(): Observable<Lobby[]> {
    return this.ok(this.lobbies.map((l) => this.withHost(l)));
  }

  getLobby(id: string): Observable<Lobby> {
    const lobby = this.lobbies.find((l) => l.id === id);
    if (!lobby) return throwError(() => ({ status: 404 })).pipe(delay(LATENCY_MS));
    return this.ok(this.withHost(lobby));
  }

  createLobby(data: CreateLobbyRequest): Observable<Lobby> {
    const lobby: Lobby = {
      ...data,
      id: uuid(),
      createdAt: new Date().toISOString(),
      host: this.effectiveHost(),
      capacity: data.capacity ?? null,
    };
    this.lobbies = [lobby, ...this.lobbies];
    return this.ok(lobby);
  }

  updateLobby(id: string, data: UpdateLobbyRequest): Observable<Lobby> {
    const lobby = this.lobbies.find((l) => l.id === id);
    if (!lobby) return throwError(() => ({ status: 404 })).pipe(delay(LATENCY_MS));
    Object.assign(lobby, data);
    return this.ok(this.withHost(lobby));
  }

  deleteLobby(id: string): Observable<void> {
    this.lobbies = this.lobbies.filter((l) => l.id !== id);
    this.players = this.players.filter((p) => p.lobbyId !== id);
    return this.ok(undefined);
  }

  listLobbyPlayers(lobbyId: string): Observable<LobbyPlayer[]> {
    return this.ok(this.players.filter((p) => p.lobbyId === lobbyId));
  }

  addLobbyPlayer(lobbyId: string, data: AddPlayerRequest): Observable<LobbyPlayer> {
    const player: LobbyPlayer = {
      id: uuid(),
      lobbyId,
      userId: data.userId ?? null,
      guestName: data.guestName ?? null,
      position: data.position ?? '',
      approved: false,
      paid: false,
      joinedAt: new Date().toISOString(),
      user: null,
    };
    this.players = [...this.players, player];
    return this.ok(player);
  }

  updateLobbyPlayer(
    lobbyId: string,
    playerId: string,
    data: UpdatePlayerRequest,
  ): Observable<LobbyPlayer> {
    const player = this.players.find((p) => p.id === playerId && p.lobbyId === lobbyId);
    if (!player) return throwError(() => ({ status: 404 })).pipe(delay(LATENCY_MS));
    Object.assign(player, data);
    return this.ok(player);
  }

  removeLobbyPlayer(lobbyId: string, playerId: string): Observable<void> {
    this.players = this.players.filter((p) => !(p.id === playerId && p.lobbyId === lobbyId));
    return this.ok(undefined);
  }

  // The signed-in user (mapped to a public shape), or the demo host.
  private effectiveHost(): PublicUser {
    const u = this.auth.currentUser();
    if (!u) return MOCK_HOST;
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      pictureUrl: u.pictureUrl,
    };
  }

  // Present every lobby as hosted by the viewer so host tools are usable in the demo.
  private withHost(lobby: Lobby): Lobby {
    return { ...lobby, host: this.effectiveHost() };
  }

  private ok<T>(value: T): Observable<T> {
    return of(value).pipe(delay(LATENCY_MS));
  }
}

function seedLobbies(): Lobby[] {
  const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
  return [
    {
      id: 'mock-lobby-1',
      lobbyName: 'Sunday Night Drop-In',
      location: 'WePlay Sports Dome',
      startTime: inHours(6),
      endTime: inHours(8),
      price: 10,
      skillLevel: 'INTERMEDIATE',
      genderFormat: 'COED',
      allowToApply: true,
      capacity: 24,
      createdAt: new Date().toISOString(),
      host: MOCK_HOST,
    },
    {
      id: 'mock-lobby-2',
      lobbyName: 'Saturday Open Gym',
      location: 'Downtown Rec Center',
      startTime: inHours(30),
      endTime: inHours(32),
      price: 0,
      skillLevel: 'OPEN',
      genderFormat: 'COED',
      allowToApply: true,
      capacity: null,
      createdAt: new Date().toISOString(),
      host: MOCK_HOST,
    },
  ];
}

function seedPlayers(): LobbyPlayer[] {
  const names = [
    'Alex Chen', 'Priya Nair', 'Marcus Lee', 'Sofia Ramos', 'Devon Park',
    'Hana Kim', 'Liam Walsh', 'Aisha Khan', 'Noah Bennett', 'Mia Torres',
    'Ethan Wright', 'Zoe Martin', 'Caleb Ford', 'Isla Rossi', 'Omar Haddad',
    'Nina Petrov', 'Jamal Brooks', 'Lena Fischer', 'Ravi Desai', 'Grace Obi',
    'Tomas Silva', 'Yuki Sato', 'Elena Vega', 'Kofi Mensah',
  ];
  // Cycle through volleyball roles so the team maker has positions to spread.
  const roles = ['Setter', 'Outside', 'Middle', 'Opposite', 'Libero', 'Outside'];
  const base = Date.now() - names.length * 60_000;
  return names.map((name, i) => ({
    id: `mock-player-${i + 1}`,
    lobbyId: 'mock-lobby-1',
    userId: null,
    guestName: name,
    position: roles[i % roles.length],
    approved: true,
    paid: i % 3 !== 0,
    joinedAt: new Date(base + i * 60_000).toISOString(),
    user: null,
  }));
}

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`;
}
