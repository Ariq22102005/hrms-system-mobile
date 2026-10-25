// Pure rules for an employee overtime request. They mirror the server so mistakes are caught before sending.
export const MAX_OVERTIME_MINUTES = 12 * 60;
export const MAX_DESCRIPTION = 500;
export const DATE_WINDOW_DAYS = 31;
export const STEP_MINUTES = 30;
const LAST_STEP = 23 * 60 + 30;

export type OvertimeSlot = { date: string; start_time: string; end_time: string; status: string };
export type OvertimeDraft = { date: string; start_time: string; end_time: string; description: string };
export type DraftError = 'time_order' | 'too_long' | 'description_required' | 'description_long' | 'date_window' | 'overlap';

export const timeToMinutes = (time: string) => { const [h, m] = time.split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0; };
export const minutesToTime = (minutes: number) => { const clamped = Math.min(Math.max(Math.round(minutes), 0), 23 * 60 + 59); return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`; };
export const durationMinutes = (start: string, end: string) => Math.max(0, timeToMinutes(end) - timeToMinutes(start));
/** Moves a time by whole steps and keeps it on the 30-minute grid between 00:00 and 23:30. */
export const shiftTime = (time: string, steps: number) => minutesToTime(Math.min(Math.max(timeToMinutes(time) + steps * STEP_MINUTES, 0), LAST_STEP));
export const endAfter = (start: string, hours: number) => { const end = timeToMinutes(start) + hours * 60; return end > LAST_STEP ? null : minutesToTime(end); };

export function formatMinutes(minutes: number, language: 'id' | 'en') {
  const hours = Math.floor(minutes / 60); const rest = minutes % 60; const h = language === 'en' ? 'h' : 'j';
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}${h}` : `${hours}${h} ${rest}m`;
}

const dayNumber = (key: string) => Date.parse(`${key}T00:00:00Z`) / 86400000;
export const withinDateWindow = (date: string, today: string) => Math.abs(dayNumber(date) - dayNumber(today)) <= DATE_WINDOW_DAYS;

/** First existing request/assignment (not rejected) that shares time with the draft on the same date. */
export function findOverlap(existing: readonly OvertimeSlot[], draft: Pick<OvertimeDraft, 'date' | 'start_time' | 'end_time'>): OvertimeSlot | null {
  const start = timeToMinutes(draft.start_time); const end = timeToMinutes(draft.end_time);
  return existing.find((item) => item.status !== 'rejected' && item.date === draft.date && timeToMinutes(item.start_time) < end && timeToMinutes(item.end_time) > start) ?? null;
}

export function validateDraft(draft: OvertimeDraft, existing: readonly OvertimeSlot[], today: string): DraftError | null {
  const length = durationMinutes(draft.start_time, draft.end_time);
  if (length <= 0) return 'time_order';
  if (length > MAX_OVERTIME_MINUTES) return 'too_long';
  if (!draft.description.trim()) return 'description_required';
  if (draft.description.length > MAX_DESCRIPTION) return 'description_long';
  if (!withinDateWindow(draft.date, today)) return 'date_window';
  if (findOverlap(existing, draft)) return 'overlap';
  return null;
}
