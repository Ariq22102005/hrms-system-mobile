import { describe, expect, it } from 'vitest';
import { durationMinutes, endAfter, findOverlap, formatMinutes, minutesToTime, shiftTime, timeToMinutes, validateDraft, withinDateWindow } from './overtimeRequest';

const draft = { date: '2026-10-20', start_time: '17:00', end_time: '19:30', description: 'Laporan bulanan' };
const slot = (over: Partial<{ date: string; start_time: string; end_time: string; status: string }> = {}) => ({ date: '2026-10-20', start_time: '08:00', end_time: '10:00', status: 'pending', ...over });

describe('overtime time helpers', () => {
  it('converts and measures time', () => {
    expect(timeToMinutes('17:30')).toBe(1050); expect(minutesToTime(1050)).toBe('17:30');
    expect(minutesToTime(-5)).toBe('00:00'); expect(minutesToTime(5000)).toBe('23:59');
    expect(durationMinutes('17:00', '19:30')).toBe(150); expect(durationMinutes('19:00', '17:00')).toBe(0);
  });
  it('steps in 30 minutes and stays inside the day', () => {
    expect(shiftTime('17:00', 1)).toBe('17:30'); expect(shiftTime('17:00', -2)).toBe('16:00');
    expect(shiftTime('00:00', -1)).toBe('00:00'); expect(shiftTime('23:30', 1)).toBe('23:30');
  });
  it('builds an end time from a number of hours, or null when it would pass midnight', () => {
    expect(endAfter('17:00', 2)).toBe('19:00'); expect(endAfter('22:00', 3)).toBeNull(); expect(endAfter('21:30', 2)).toBe('23:30');
  });
  it('formats durations in both languages', () => {
    expect(formatMinutes(150, 'id')).toBe('2j 30m'); expect(formatMinutes(150, 'en')).toBe('2h 30m');
    expect(formatMinutes(120, 'id')).toBe('2j'); expect(formatMinutes(30, 'id')).toBe('30m');
  });
});

describe('overtime date window and overlaps', () => {
  it('accepts dates within 31 days either way', () => {
    expect(withinDateWindow('2026-11-20', '2026-10-20')).toBe(true); expect(withinDateWindow('2026-11-21', '2026-10-20')).toBe(false); expect(withinDateWindow('2026-09-18', '2026-10-20')).toBe(false); expect(withinDateWindow('2026-09-19', '2026-10-20')).toBe(true);
  });
  it('finds overlaps on the same date only, ignores rejected, allows touching', () => {
    const base = { date: '2026-10-20', start_time: '17:00', end_time: '19:00' };
    expect(findOverlap([slot({ start_time: '16:00', end_time: '17:30' })], base)).not.toBeNull();
    expect(findOverlap([slot({ start_time: '19:00', end_time: '20:00' })], base)).toBeNull();
    expect(findOverlap([slot({ date: '2026-10-21', start_time: '17:00', end_time: '19:00' })], base)).toBeNull();
    expect(findOverlap([slot({ start_time: '17:00', end_time: '19:00', status: 'rejected' })], base)).toBeNull();
    expect(findOverlap([slot({ start_time: '17:00', end_time: '19:00', status: 'assigned' })], base)).not.toBeNull();
  });
});

describe('validateDraft', () => {
  const today = '2026-10-20';
  it('accepts a good draft', () => expect(validateDraft(draft, [], today)).toBeNull());
  it('reports the first problem', () => {
    expect(validateDraft({ ...draft, end_time: '17:00' }, [], today)).toBe('time_order');
    expect(validateDraft({ ...draft, start_time: '06:00', end_time: '19:00' }, [], today)).toBe('too_long');
    expect(validateDraft({ ...draft, description: '  ' }, [], today)).toBe('description_required');
    expect(validateDraft({ ...draft, description: 'x'.repeat(501) }, [], today)).toBe('description_long');
    expect(validateDraft({ ...draft, date: '2026-12-31' }, [], today)).toBe('date_window');
    expect(validateDraft(draft, [slot({ start_time: '18:00', end_time: '20:00' })], today)).toBe('overlap');
  });
});
