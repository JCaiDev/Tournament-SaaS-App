import { Component, input } from '@angular/core';
import { LobbyFormat } from '../../models/lobby';

// Line icon for a lobby format: a volleyball for pickup, a trophy for tournaments.
// Strokes use currentColor, so the parent's `color` sets the icon color.
@Component({
  selector: 'app-format-icon',
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @if (format() === 'TOURNAMENT') {
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      } @else {
        <circle cx="12" cy="12" r="10" />
        <path d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4" />
        <path d="M12 12a12.6 12.6 0 0 1-8.7 5" />
        <path d="M16.8 13.6a16.55 16.55 0 0 1-9 7.5" />
        <path d="M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10" />
        <path d="M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5" />
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; width: 100%; height: 100%; }
    svg { width: 100%; height: 100%; }
  `,
})
export class FormatIcon {
  readonly format = input.required<LobbyFormat>();
}
