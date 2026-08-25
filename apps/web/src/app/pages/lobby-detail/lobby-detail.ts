import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LobbyService } from '../../services/lobby.service';
import {
  GENDER_LABELS,
  Lobby,
  LobbyPlayer,
  SKILL_LABELS,
  UpdatePlayerRequest,
} from '../../models/lobby';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-lobby-detail',
  imports: [RouterLink, DatePipe, CurrencyPipe, ReactiveFormsModule, NgTemplateOutlet],
  templateUrl: './lobby-detail.html',
  styleUrl: './lobby-detail.css',
})
export class LobbyDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly lobbyService = inject(LobbyService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router)
  private readonly fb = inject(FormBuilder);

  readonly lobby = signal<Lobby | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly error = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  // Player roster
  readonly players = signal<LobbyPlayer[]>([]);
  readonly playersLoading = signal(true);
  readonly playersError = signal<string | null>(null);
  readonly adding = signal(false);
  readonly addError = signal<string | null>(null);
  // Id of the row currently being updated/removed, for per-row disabled state.
  readonly savingId = signal<string | null>(null);

  readonly addForm = this.fb.nonNullable.group({
    guestName: ['', [Validators.required, Validators.minLength(1)]],
    position: [''],
  });

  private readonly guestNameInput =
    viewChild<ElementRef<HTMLInputElement>>('guestNameInput');

  // Inline roster edit — id of the row being edited, plus its working form.
  readonly editingId = signal<string | null>(null);
  readonly editForm = this.fb.nonNullable.group({
    guestName: [''],
    position: [''],
  });

  // Host controls
  readonly capacitySaving = signal(false);
  readonly acceptingSaving = signal(false);
  readonly hostActionError = signal<string | null>(null);
  readonly copied = signal(false);
  // Name of the player just bumped from the waitlist, shown briefly.
  readonly promotedName = signal<string | null>(null);

  // Roster cap (null = unlimited).
  readonly cap = computed(() => this.lobby()?.capacity ?? null);

  // Stable ordering: earliest to join is first in line.
  readonly sortedPlayers = computed(() =>
    [...this.players()].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)),
  );

  readonly rosterPlayers = computed(() => {
    const c = this.cap();
    const all = this.sortedPlayers();
    return c && c > 0 ? all.slice(0, c) : all;
  });

  readonly waitlistPlayers = computed(() => {
    const c = this.cap();
    return c && c > 0 ? this.sortedPlayers().slice(c) : [];
  });

  readonly spotsFilled = computed(() => this.rosterPlayers().length);
  readonly isFull = computed(() => {
    const c = this.cap();
    return c != null && c > 0 && this.spotsFilled() >= c;
  });
  readonly fillPct = computed(() => {
    const c = this.cap();
    if (!c || c <= 0) return 0;
    return Math.min(100, Math.round((this.spotsFilled() / c) * 100));
  });

  readonly paidCount = computed(() => this.players().filter((p) => p.paid).length);
  readonly amountCollected = computed(
    () => this.paidCount() * (this.lobby()?.price ?? 0),
  );

  // Team maker — assignments (playerId -> team index) are the single source of truth.
  readonly teamCount = signal(4);
  readonly assignments = signal<Record<string, number>>({});

  readonly manualTeams = computed<LobbyPlayer[][]>(() => {
    const n = this.teamCount();
    const map = this.assignments();
    const buckets: LobbyPlayer[][] = Array.from({ length: n }, () => []);
    for (const p of this.rosterPlayers()) {
      const idx = map[p.id];
      if (idx != null && idx >= 0 && idx < n) buckets[idx].push(p);
    }
    return buckets;
  });

  readonly unassignedPlayers = computed<LobbyPlayer[]>(() => {
    const n = this.teamCount();
    const map = this.assignments();
    return this.rosterPlayers().filter((p) => {
      const idx = map[p.id];
      return idx == null || idx < 0 || idx >= n;
    });
  });

  readonly placedCount = computed(
    () => this.rosterPlayers().length - this.unassignedPlayers().length,
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.lobbyService.getLobby(id).subscribe({
      next: (lobby) => {
        this.lobby.set(lobby);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.notFound.set(true);
        } else {
          this.error.set('Something went wrong loading this lobby.');
        }
      },
    });

    this.loadPlayers(id);
  }

  private loadPlayers(lobbyId: string): void {
    this.playersLoading.set(true);
    this.playersError.set(null);
    this.lobbyService.listLobbyPlayers(lobbyId).subscribe({
      next: (players) => {
        this.players.set(players);
        this.playersLoading.set(false);
      },
      error: () => {
        this.playersLoading.set(false);
        this.playersError.set('Could not load the player list.');
      },
    });
  }

  get skillLabel(): string {
    const l = this.lobby();
    return l ? SKILL_LABELS[l.skillLevel] : '';
  }

  get genderLabel(): string {
    const l = this.lobby();
    return l ? GENDER_LABELS[l.genderFormat] : '';
  }

  canDelete(): boolean {
    const user = this.auth.currentUser();
    const lobby = this.lobby();
    if (!user || !lobby ) return false;
    return user.id === lobby.host.id || user.role === "ADMIN";
  }

  deleteLobby():void {
    const lobby = this.lobby();
    if (!lobby || !confirm('Delete this lobby? This cannot be undone.')) return;
    this.deleting.set(true);
    this.lobbyService.deleteLobby(lobby.id).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => { this.deleting.set(false); this.deleteError.set('Could not delete this lobby')}
    })
  }

  // Host or admin may manage the roster.
  canManage(): boolean {
    const user = this.auth.currentUser();
    const lobby = this.lobby();
    if (!user || !lobby) return false;
    return user.id === lobby.host.id || user.role === 'ADMIN';
  }

  playerName(player: LobbyPlayer): string {
    return player.user?.name ?? player.guestName ?? 'Guest';
  }

  addPlayer(): void {
    const lobby = this.lobby();
    if (!lobby) return;
    this.addError.set(null);
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    const { guestName, position } = this.addForm.getRawValue();
    this.adding.set(true);
    this.lobbyService
      .addLobbyPlayer(lobby.id, { guestName: guestName.trim(), position: position.trim() })
      .subscribe({
        next: (player) => {
          this.players.update((list) => [...list, player]);
          this.addForm.reset({ guestName: '', position: '' });
          this.adding.set(false);
          this.guestNameInput()?.nativeElement.focus();
        },
        error: (err: HttpErrorResponse) => {
          this.adding.set(false);
          if (err.status === 403) this.addError.set('Only the host can add players.');
          else if (err.status === 400) this.addError.set('Enter a name for the player.');
          else this.addError.set('Could not add the player.');
        },
      });
  }

  removePlayer(player: LobbyPlayer): void {
    const lobby = this.lobby();
    if (!lobby || !confirm(`Remove ${this.playerName(player)} from this lobby?`)) return;
    // Capture who's next in line so we can flag an auto-promotion afterwards.
    const wasOnRoster = this.rosterPlayers().some((p) => p.id === player.id);
    const nextUp = this.waitlistPlayers()[0] ?? null;
    this.savingId.set(player.id);
    this.lobbyService.removeLobbyPlayer(lobby.id, player.id).subscribe({
      next: () => {
        this.players.update((list) => list.filter((p) => p.id !== player.id));
        this.savingId.set(null);
        if (wasOnRoster && nextUp) this.announcePromotion(nextUp);
      },
      error: () => {
        this.savingId.set(null);
        this.playersError.set('Could not remove that player.');
      },
    });
  }

  toggleApproved(player: LobbyPlayer): void {
    this.patchPlayer(player, { approved: !player.approved });
  }

  togglePaid(player: LobbyPlayer): void {
    this.patchPlayer(player, { paid: !player.paid });
  }

  startEdit(player: LobbyPlayer): void {
    this.editingId.set(player.id);
    this.editForm.reset({
      guestName: player.guestName ?? player.user?.name ?? '',
      position: player.position ?? '',
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(player: LobbyPlayer): void {
    const { guestName, position } = this.editForm.getRawValue();
    const changes: UpdatePlayerRequest = { position: position.trim() };
    // Only guests have an editable name; registered users' names come from their account.
    if (!player.user) {
      const name = guestName.trim();
      if (!name) return;
      changes.guestName = name;
    }
    this.patchPlayer(player, changes, () => this.editingId.set(null));
  }

  private patchPlayer(
    player: LobbyPlayer,
    changes: UpdatePlayerRequest,
    onDone?: () => void,
  ): void {
    const lobby = this.lobby();
    if (!lobby) return;
    this.savingId.set(player.id);
    this.lobbyService.updateLobbyPlayer(lobby.id, player.id, changes).subscribe({
      next: (updated) => {
        this.players.update((list) =>
          list.map((p) => (p.id === updated.id ? updated : p)),
        );
        this.savingId.set(null);
        onDone?.();
      },
      error: () => {
        this.savingId.set(null);
        this.playersError.set('Could not update that player.');
      },
    });
  }

  // ----- Roster cap controls -----

  raiseCap(): void {
    const c = this.cap();
    const base = c && c > 0 ? c : this.players().length;
    this.saveCapacity(base + 1);
  }

  lowerCap(): void {
    const c = this.cap();
    if (!c || c <= 1) return;
    this.saveCapacity(c - 1);
  }

  setCap(): void {
    // Sensible default for a drop-in: two courts of six, but never below current turnout.
    this.saveCapacity(Math.max(this.players().length, 12));
  }

  clearCap(): void {
    this.saveCapacity(null);
  }

  private saveCapacity(next: number | null): void {
    const lobby = this.lobby();
    if (!lobby || this.capacitySaving()) return;
    this.hostActionError.set(null);
    this.capacitySaving.set(true);
    this.lobbyService.updateLobby(lobby.id, { capacity: next }).subscribe({
      next: (updated) => {
        this.lobby.set(updated);
        this.capacitySaving.set(false);
      },
      error: () => {
        this.capacitySaving.set(false);
        this.hostActionError.set('Could not update the roster cap.');
      },
    });
  }

  toggleAccepting(): void {
    const lobby = this.lobby();
    if (!lobby || this.acceptingSaving()) return;
    this.hostActionError.set(null);
    this.acceptingSaving.set(true);
    this.lobbyService.updateLobby(lobby.id, { allowToApply: !lobby.allowToApply }).subscribe({
      next: (updated) => {
        this.lobby.set(updated);
        this.acceptingSaving.set(false);
      },
      error: () => {
        this.acceptingSaving.set(false);
        this.hostActionError.set('Could not update the lobby.');
      },
    });
  }

  copyInvite(): void {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      })
      .catch(() => this.hostActionError.set('Could not copy the invite link.'));
  }

  private announcePromotion(player: LobbyPlayer): void {
    this.promotedName.set(this.playerName(player));
    setTimeout(() => this.promotedName.set(null), 4000);
  }

  // ----- Team maker -----

  raiseTeams(): void {
    const max = Math.max(2, this.rosterPlayers().length);
    this.teamCount.update((n) => Math.min(max, n + 1));
  }

  lowerTeams(): void {
    this.teamCount.update((n) => Math.max(2, n - 1));
  }

  teamLabel(index: number): string {
    return String.fromCharCode(65 + index); // A, B, C, ...
  }

  // Current team letter for a player, or null if benched.
  teamOf(playerId: string): string | null {
    const idx = this.assignments()[playerId];
    if (idx == null || idx < 0 || idx >= this.teamCount()) return null;
    return this.teamLabel(idx);
  }

  // Auto-distribute everyone into balanced teams; the result stays editable.
  generateTeams(): void {
    const pool = [...this.rosterPlayers()];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Group by position, then deal round-robin so roles spread and sizes stay even.
    pool.sort((a, b) => (a.position || '~').localeCompare(b.position || '~'));
    const count = Math.max(1, this.teamCount());
    const map: Record<string, number> = {};
    pool.forEach((p, i) => (map[p.id] = i % count));
    this.assignments.set(map);
  }

  assignPlayer(playerId: string, teamIndex: number): void {
    this.assignments.update((m) => ({ ...m, [playerId]: teamIndex }));
  }

  clearTeams(): void {
    this.assignments.set({});
  }

  // ----- Custom team names -----

  // teamIndex -> custom name; falls back to "Team A/B/..." when empty.
  readonly teamNames = signal<Record<number, string>>({});

  teamName(index: number): string {
    return this.teamNames()[index]?.trim() || `Team ${this.teamLabel(index)}`;
  }

  renameTeam(index: number, name: string): void {
    this.teamNames.update((m) => ({ ...m, [index]: name }));
  }

  // ----- Pools (groups of teams) -----

  readonly poolCount = signal(2);
  // teamIndex -> poolIndex
  readonly poolAssignments = signal<Record<number, number>>({});

  readonly pools = computed<number[][]>(() => {
    const n = this.poolCount();
    const map = this.poolAssignments();
    const buckets: number[][] = Array.from({ length: n }, () => []);
    for (let t = 0; t < this.teamCount(); t++) {
      const p = map[t];
      if (p != null && p >= 0 && p < n) buckets[p].push(t);
    }
    return buckets;
  });

  readonly unassignedTeams = computed<number[]>(() => {
    const n = this.poolCount();
    const map = this.poolAssignments();
    const teams: number[] = [];
    for (let t = 0; t < this.teamCount(); t++) {
      const p = map[t];
      if (p == null || p < 0 || p >= n) teams.push(t);
    }
    return teams;
  });

  readonly pooledTeamCount = computed(
    () => this.teamCount() - this.unassignedTeams().length,
  );

  raisePools(): void {
    const max = Math.max(2, this.teamCount());
    this.poolCount.update((n) => Math.min(max, n + 1));
  }

  lowerPools(): void {
    this.poolCount.update((n) => Math.max(2, n - 1));
  }

  generatePools(): void {
    const count = Math.max(1, this.poolCount());
    const map: Record<number, number> = {};
    for (let t = 0; t < this.teamCount(); t++) map[t] = t % count;
    this.poolAssignments.set(map);
  }

  assignTeamToPool(teamIndex: number, poolIndex: number): void {
    this.poolAssignments.update((m) => ({ ...m, [teamIndex]: poolIndex }));
  }

  clearPools(): void {
    this.poolAssignments.set({});
  }

  poolLabel(index: number): string {
    return `Pool ${index + 1}`;
  }



}
