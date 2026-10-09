// Helpers for the picker's value format: a local "YYYY-MM-DDTHH:mm" string
// (no timezone, no seconds), the same thing <input type="datetime-local"> uses.

/** Adds whole hours to a local "YYYY-MM-DDTHH:mm" value; rolls into the next day if needed. */
export function addHours(value: string, hours: number): string {
  const date = new Date(value); // a date-time string without a zone is parsed as local time
  if (Number.isNaN(date.getTime())) return '';
  date.setHours(date.getHours() + hours);
  return toLocalValue(date);
}

function toLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
