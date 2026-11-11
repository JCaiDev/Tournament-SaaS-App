// Helpers for the picker's value format: a local "YYYY-MM-DDTHH:mm" string
// (no timezone, no seconds), the same thing <input type="datetime-local"> uses.

/** Adds whole hours to a local "YYYY-MM-DDTHH:mm" value; rolls into the next day if needed. */
export function addHours(value: string, hours: number): string {
  const date = new Date(value); // a date-time string without a zone is parsed as local time
  if (Number.isNaN(date.getTime())) return '';
  date.setHours(date.getHours() + hours);
  return toLocalValue(date);
}

/**
 * Turns the picker's local "YYYY-MM-DDTHH:mm" into a full UTC timestamp
 * ("2026-11-15T14:00:00.000Z") for the API.
 *
 * Only the browser knows the organizer's timezone. If we sent the bare local
 * string, the server would read it in ITS timezone (UTC on Render), so 9:00 AM
 * in Toronto would be saved as 9:00 UTC and shown back as 4:00 AM.
 */
export function toUtcIso(value: string): string {
  const date = new Date(value); // no zone in the string → parsed as local time
  // Leave a broken value alone so the API answers 400 instead of us throwing.
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
