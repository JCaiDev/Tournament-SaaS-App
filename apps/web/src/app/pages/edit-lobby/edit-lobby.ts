import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LobbyService } from '../../services/lobby.service';
import { GENDER_LABELS, GenderFormat, SkillLevel, SKILL_LABELS, UpdateLobbyRequest } from '../../models/lobby';
import { DatetimePicker } from '../../shared/datetime-picker/datetime-picker';
/**
 * Converts an ISO string (e.g. "2026-07-26T19:11:00.000Z") to the format
 * that <input type="datetime-local"> expects: "2026-07-26T19:11"
 */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  // Pad month/day/hours/minutes to 2 digits
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'app-edit-lobby',
  imports: [ReactiveFormsModule, DatetimePicker],
  templateUrl: './edit-lobby.html',
  styleUrl: './edit-lobby.css',
})
export class EditLobby implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly lobbyService = inject(LobbyService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly skillOptions = Object.entries(SKILL_LABELS);
  readonly genderOptions = Object.entries(GENDER_LABELS);

  readonly form = this.fb.nonNullable.group({
    lobbyName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(35)]],
    location: ['', [Validators.required, Validators.minLength(3)]],
    startTime: ['', [Validators.required]],
    endTime: ['', [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
    skillLevel: ['OPEN' as SkillLevel, [Validators.required]],
    genderFormat: ['COED' as GenderFormat, [Validators.required]],
    allowToApply: [true],
    capacity: [0, [Validators.min(0)]],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.lobbyService.getLobby(id).subscribe({
      next: (lobby) => {
        // Pre-fill the form with existing lobby data
        this.form.patchValue({
          lobbyName: lobby.lobbyName,
          location: lobby.location,
          startTime: toDatetimeLocal(lobby.startTime),
          endTime: toDatetimeLocal(lobby.endTime),
          price: lobby.price,
          skillLevel: lobby.skillLevel,
          genderFormat: lobby.genderFormat,
          allowToApply: lobby.allowToApply,
          capacity: lobby.capacity ?? 0,
        });
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.notFound.set(true);
        } else {
          this.serverError.set('Failed to load lobby data.');
        }
      },
    });
  }

  submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.submitting.set(true);
    const raw = this.form.getRawValue();
    const payload: UpdateLobbyRequest = {
      ...raw,
      capacity: raw.capacity > 0 ? raw.capacity : null,
    };
    this.lobbyService.updateLobby(id, payload).subscribe({
      next: (lobby) => this.router.navigate(['/lobbies', lobby.id]),
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        if (err.status === 403) this.serverError.set('Only hosts can edit lobbies');
        else if (err.status === 400) this.serverError.set('Check your input - end must be after start, and start must be in the future.');
        else this.serverError.set('Something went wrong.');
      },
    });
  }
}