import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LobbyService } from '../../services/lobby.service';
import { CreateLobbyRequest, GenderFormat, GENDER_LABELS, LobbyFormat, SkillLevel, SKILL_LABELS } from '../../models/lobby';
import { DatetimePicker } from '../../shared/datetime-picker/datetime-picker';
import { FormatIcon } from '../../shared/format-icon/format-icon';
import { LOBBY_FORMATS } from '../../shared/format-icon/lobby-formats';
import { addHours } from '../../shared/datetime-picker/local-datetime';

// How long a lobby usually runs; used to pre-fill the end time.
const DEFAULT_HOURS: Record<LobbyFormat, number> = { PICKUP: 2, TOURNAMENT: 6 };

@Component({
    selector: 'app-create-lobby',
    imports: [ReactiveFormsModule, RouterLink, DatetimePicker, FormatIcon],
    templateUrl: './create-lobby.html',
    styleUrl: './create-lobby.css',
})

export class CreateLobby {
    private readonly fb = inject(FormBuilder);
    private readonly lobbyService = inject(LobbyService);
    private readonly router = inject(Router);

    // Set by the route (/lobbies/new/pickup or /lobbies/new/tournament), never by the user,
    // so the form can't be submitted without a format.
    readonly format: LobbyFormat = inject(ActivatedRoute).snapshot.data['format'];
    readonly copy = LOBBY_FORMATS[this.format];
    readonly isTournament = this.format === 'TOURNAMENT';

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
    })

    // True once the organizer picks an end time themselves; from then on we stop
    // overwriting it. Clearing the end time hands control back to the auto-fill.
    private endEdited = false;

    constructor() {
        const { startTime, endTime } = this.form.controls;

        // Our own setValue below uses emitEvent: false, so only the organizer's
        // changes reach this subscription.
        endTime.valueChanges.pipe(takeUntilDestroyed()).subscribe((end) => {
            this.endEdited = end !== '';
        });

        startTime.valueChanges.pipe(takeUntilDestroyed()).subscribe((start) => {
            if (!start || this.endEdited) return;
            endTime.setValue(addHours(start, DEFAULT_HOURS[this.format]), { emitEvent: false });
        });
    }

    submit(): void {
        this.serverError.set(null);
        if (this.form.invalid) {
            this.form.markAllAsTouched(); return;
        }

        this.submitting.set(true);
        const raw = this.form.getRawValue();
        const payload: CreateLobbyRequest = {
            ...raw,
            format: this.format,
            // Tournament teams are entered by the organizer, so players don't apply (yet).
            allowToApply: this.isTournament ? false : raw.allowToApply,
            capacity: !this.isTournament && raw.capacity > 0 ? raw.capacity : null,
        };
        this.lobbyService.createLobby(payload).subscribe({
            next: (lobby) => this.router.navigate(['/lobbies', lobby.id]),
            error: (err: HttpErrorResponse) => {
                this.submitting.set(false);
                if (err.status === 403) this.serverError.set('Only organizers can create lobbies');
                else if (err.status === 400) this.serverError.set('Check your input - end must be after start, and start must be in the future.');
                else this.serverError.set('Something went wrong.')
            }
        })
    }
}
