// Helpers for finding "fourth-Wednesday-of-the-month" dates — the canonical
// Quartinho meetup slot.

/** Returns the 4th Wednesday of the given month (year, 0-indexed month). */
export function getFourthWednesday(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const firstWed = 1 + ((3 - first.getDay() + 7) % 7);
  return new Date(year, month, firstWed + 21);
}

/** Default date for new events: 4th Wed of current month, or next month if it already passed. */
export function getDefaultEventDate(today: Date = new Date()): Date {
  const y = today.getFullYear();
  const m = today.getMonth();
  const thisMonth = getFourthWednesday(y, m);
  const startOfToday = new Date(y, m, today.getDate());
  if (thisMonth.getTime() >= startOfToday.getTime()) return thisMonth;
  return getFourthWednesday(y, m + 1);
}

/** Format a Date as YYYY-MM-DD in local time (not UTC). */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isFourthWednesday(d: Date): boolean {
  if (d.getDay() !== 3) return false;
  const day = d.getDate();
  return day >= 22 && day <= 28;
}
