import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TeamService } from '../../../services/team.service';
import { Team } from '../../../models/team';

// Same limits as the API's addTeamSchema / updateTeamSchema.
const NAME_MAX = 50;

// Saved tournament teams for one lobby. Unlike the pickup "Team maker", every
// change goes to the API, so teams survive a refresh.
@Component({
  selector: 'app-tournament-teams',
  imports: [ReactiveFormsModule],
  templateUrl: './tournament-teams.html',
  styleUrl: './tournament-teams.css',
})
export class TournamentTeams implements OnInit {
  private readonly teamService = inject(TeamService);

  readonly lobbyId = input.required<string>();
  readonly canManage = input(false);

  readonly teams = signal<Team[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly nameMax = NAME_MAX;
  // A FormGroup (not a bare FormControl) so the <form> gets ngSubmit; without
  // it the browser does a native submit and reloads the page.
  readonly addForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(NAME_MAX)],
    }),
  });
  private readonly addName = this.addForm.controls.name;
  readonly adding = signal(false);
  readonly addError = signal<string | null>(null);
  private readonly addInput = viewChild<ElementRef<HTMLInputElement>>('addInput');

  // Inline rename: the row being edited, its working name, and per-row errors.
  readonly editingId = signal<string | null>(null);
  readonly editName = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(NAME_MAX)],
  });
  private readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');
  private readonly injector = inject(Injector);
  readonly savingId = signal<string | null>(null);
  readonly rowError = signal<{ id: string; message: string } | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.teamService.listTeams(this.lobbyId()).subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(
          err.status === 401 ? 'Log in to see the teams.' : 'Could not load the teams.',
        );
      },
    });
  }

  addTeam(): void {
    this.addError.set(null);
    const name = this.addName.value.trim();
    if (!name || this.addName.invalid) {
      this.addName.markAsTouched();
      return;
    }

    this.adding.set(true);
    this.teamService.addTeam(this.lobbyId(), { name }).subscribe({
      next: (team) => {
        this.adding.set(false);
        this.teams.update((list) => sortByName([...list, team]));
        this.addName.reset();
        // Organizers usually type a whole list of teams, so stay in the box.
        this.addInput()?.nativeElement.focus();
      },
      error: (err: HttpErrorResponse) => {
        this.adding.set(false);
        this.addError.set(messageFor(err, 'Could not add the team.'));
      },
    });
  }

  startRename(team: Team): void {
    this.rowError.set(null);
    this.editingId.set(team.id);
    this.editName.setValue(team.name);
    // The input only exists after Angular renders the edit row.
    afterNextRender(() => this.renameInput()?.nativeElement.select(), {
      injector: this.injector,
    });
  }

  cancelRename(): void {
    this.editingId.set(null);
  }

  saveRename(team: Team): void {
    const name = this.editName.value.trim();
    if (!name || this.editName.invalid) return;
    if (name === team.name) {
      this.cancelRename();
      return;
    }

    this.savingId.set(team.id);
    this.rowError.set(null);
    this.teamService.renameTeam(this.lobbyId(), team.id, { name }).subscribe({
      next: (saved) => {
        this.savingId.set(null);
        this.editingId.set(null);
        this.teams.update((list) => sortByName(list.map((t) => (t.id === saved.id ? saved : t))));
      },
      error: (err: HttpErrorResponse) => {
        this.savingId.set(null);
        this.handleRowError(team, err, 'Could not rename the team.');
      },
    });
  }

  deleteTeam(team: Team): void {
    if (!confirm(`Delete "${team.name}"? Its players will become free agents.`)) return;

    this.savingId.set(team.id);
    this.rowError.set(null);
    this.teamService.deleteTeam(this.lobbyId(), team.id).subscribe({
      next: () => {
        this.savingId.set(null);
        this.teams.update((list) => list.filter((t) => t.id !== team.id));
      },
      error: (err: HttpErrorResponse) => {
        this.savingId.set(null);
        this.handleRowError(team, err, 'Could not delete the team.');
      },
    });
  }

  onRenameKeydown(event: KeyboardEvent, team: Team): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelRename();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.saveRename(team);
    }
  }

  // 404 = someone else already deleted it (another tab or device): drop the stale row.
  private handleRowError(team: Team, err: HttpErrorResponse, fallback: string): void {
    if (err.status === 404) {
      this.teams.update((list) => list.filter((t) => t.id !== team.id));
      this.editingId.set(null);
      return;
    }
    this.rowError.set({ id: team.id, message: messageFor(err, fallback) });
  }
}

function sortByName(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => a.name.localeCompare(b.name));
}

// The API's error body is { error: { message } }. Show its message for the
// statuses where it's written for users (409 duplicate name); otherwise a fallback.
function messageFor(err: HttpErrorResponse, fallback: string): string {
  if (err.status === 409) return err.error?.error?.message ?? 'That name is already taken.';
  if (err.status === 400) return `Names must be 1–${NAME_MAX} characters.`;
  if (err.status === 403) return 'Only this tournament’s organizer can change teams.';
  return fallback;
}
