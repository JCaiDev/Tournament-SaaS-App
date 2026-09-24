// Pure helpers for the time dropdown: no DOM, no signals, so they're easy to test.

// Evening is when most drop-ins start, so an empty field opens here.
export const DEFAULT_ANCHOR = '17:00';

// Which option the list opens on: the selected time if it's in the list,
// otherwise the fallback, otherwise the first option. -1 if the list is empty.
export function anchorIndex(
  values: string[],
  selected: string,
  fallback: string = DEFAULT_ANCHOR,
): number {
  const selectedIndex = values.indexOf(selected);
  if (selectedIndex !== -1) return selectedIndex;
  const fallbackIndex = values.indexOf(fallback);
  if (fallbackIndex !== -1) return fallbackIndex;
  return values.length ? 0 : -1;
}

// Where a navigation key moves the highlight. Stops at the ends instead of wrapping,
// and returns null for keys that aren't navigation keys.
export function nextIndex(
  current: number,
  key: string,
  count: number,
  pageSize: number,
): number | null {
  const last = count - 1;
  switch (key) {
    case 'ArrowDown':
      return Math.min(last, current + 1);
    case 'ArrowUp':
      return Math.max(0, current - 1);
    case 'PageDown':
      return Math.min(last, current + pageSize);
    case 'PageUp':
      return Math.max(0, current - pageSize);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}
