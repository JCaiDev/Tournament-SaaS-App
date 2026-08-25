import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { LobbyService } from '../../services/lobby.service';
import { GENDER_LABELS, Lobby, SKILL_LABELS } from '../../models/lobby';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe, CurrencyPipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private readonly lobbyService = inject(LobbyService);

  readonly lobbies = signal<Lobby[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadLobbies();
  }

  loadLobbies(): void {
    this.loading.set(true);
    this.error.set(null);

    this.lobbyService.listLobbies().subscribe({
      next: (lobbies) => {
        this.lobbies.set(lobbies);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          'Could not load lobbies. Make sure the API is running on port 3001.'
        );
        this.loading.set(false);
      },
    });
  }

  skillLabel(lobby: Lobby): string {
    return SKILL_LABELS[lobby.skillLevel];
  }

  genderLabel(lobby: Lobby): string {
    return GENDER_LABELS[lobby.genderFormat];
  }
}
