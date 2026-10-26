import { signal } from '@angular/core';
import { Observable } from 'rxjs';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

// Debounced autosave for full-replace endpoints (PUT the whole state).
//
// - Debounce: schedule() waits `delayMs` after the *last* change, so dragging
//   five teams in a row sends one request, not five.
// - Never two requests in flight: if a change arrives while a save is running,
//   it waits and sends again when that one finishes. Two overlapping PUTs could
//   reach the server in either order, and an older layout landing last would
//   overwrite the newer one (a lost update).
// - send() reads the state at the moment it runs, so the follow-up save always
//   carries the latest layout, never a stale copy.
export class SerialSaver {
  readonly status = signal<SaveStatus>('idle');
  readonly error = signal<unknown>(null);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private dirty = false;

  constructor(
    private readonly send: () => Observable<unknown>,
    private readonly delayMs = 1000,
  ) {}

  /** Call after every change. */
  schedule(): void {
    this.dirty = true;
    this.status.set('pending');
    this.clearTimer();
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  /** Save now instead of waiting (Retry button, leaving the page). */
  flush(): void {
    this.clearTimer();
    if (!this.dirty || this.inFlight) return; // a running save re-checks `dirty` when it ends
    this.dirty = false;
    this.inFlight = true;
    this.status.set('saving');
    this.send().subscribe({
      next: () => this.finish(null),
      error: (err: unknown) => this.finish(err),
    });
  }

  private finish(err: unknown): void {
    this.inFlight = false;
    if (err) {
      this.dirty = true; // keep the change so Retry sends it
      this.error.set(err);
      this.status.set('error');
      return;
    }
    this.error.set(null);
    if (this.dirty) {
      this.flush(); // something changed while we were saving
    } else {
      this.status.set('saved');
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
