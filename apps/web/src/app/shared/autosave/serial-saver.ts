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
  // Goes up by 1 after every successful save. Lets other parts of the page
  // notice "the server state just changed" (e.g. saving pools deletes the
  // draft schedule on the server).
  readonly savedCount = signal(0);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private dirty = false;
  private waiters: ((ok: boolean) => void)[] = [];

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

  /**
   * Save anything pending right now, then resolve once nothing is left to send:
   * true = everything is on the server, false = the save failed.
   * Use it before a request that depends on this state being saved first.
   */
  settle(): Promise<boolean> {
    this.flush();
    if (!this.inFlight && !this.dirty) return Promise.resolve(true);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private finish(err: unknown): void {
    this.inFlight = false;
    if (err) {
      this.dirty = true; // keep the change so Retry sends it
      this.error.set(err);
      this.status.set('error');
      this.resolveWaiters(false);
      return;
    }
    this.error.set(null);
    this.savedCount.update((n) => n + 1);
    if (this.dirty) {
      this.flush(); // something changed while we were saving
    } else {
      this.status.set('saved');
      this.resolveWaiters(true);
    }
  }

  private resolveWaiters(ok: boolean): void {
    const waiters = this.waiters;
    this.waiters = [];
    waiters.forEach((resolve) => resolve(ok));
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
