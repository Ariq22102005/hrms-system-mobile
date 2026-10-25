import { describe, it, expect } from 'vitest';
import { attendanceSummary, attendanceVerificationLabel, formatDuration, dateKey } from './attendanceSummary';
import type { AttendanceDto } from './api';
const record = (id: number, type: AttendanceDto['type'], time: string): AttendanceDto => ({ id, type, recorded_at: time, latitude: 0, longitude: 0 });
describe('attendance summary with authoritative WIB dates', () => {
  it('labels only statuses explicitly authorized by the server as verified', () => {
    const base = record(1, 'check-in', '2026-10-12T01:00:00Z');
    expect(attendanceVerificationLabel({ ...base, face_status: 'matched', location_status: 'pending' })).toBe('faceVerified');
    expect(attendanceVerificationLabel({ ...base, face_status: 'verified', location_status: 'verified' })).toBe('serverVerified');
    expect(attendanceVerificationLabel({ ...base, face_status: 'pending', location_status: 'verified' })).toBe('verificationPending');
    expect(attendanceSummary([{ ...base, face_status: 'pending', location_status: 'verified' }], new Date('2026-10-12T02:00:00Z')).daysPresent).toBe(0);
    expect(attendanceVerificationLabel(base)).toBe('legacyAttendance');
  });
  it('calculates today and completed monthly hours without counting check-ins twice', () => {
    const records = [record(1, 'check-in', '2026-10-04T01:00:00Z'), record(2, 'check-out', '2026-10-04T09:00:00Z'), record(3, 'check-in', '2026-10-03T01:00:00Z'), record(4, 'check-out', '2026-10-03T05:00:00Z'), record(5, 'check-in', '2026-10-03T01:00:00Z')];
    const s = attendanceSummary(records, new Date('2026-10-04T10:00:00Z'));
    expect(s.daysPresent).toBe(2); expect(formatDuration(s.durationMs)).toBe('8:00'); expect(formatDuration(s.monthlyMs)).toBe('12:00');
  });
  it('updates an open shift, excludes older incomplete shifts and ignores invalid timestamps', () => {
    const s = attendanceSummary([record(1, 'check-in', '2026-10-04T01:00:00Z'), record(2, 'check-in', '2026-10-03T01:00:00Z'), record(3, 'check-in', 'invalid')], new Date('2026-10-04T02:30:00Z'));
    expect(formatDuration(s.durationMs)).toBe('1:30'); expect(formatDuration(s.monthlyMs)).toBe('1:30'); expect(s.daysPresent).toBe(2);
  });
  it('handles timezone/month boundary and impossible negative durations', () => {
    expect(dateKey(new Date('2026-09-30T18:00:00Z'))).toBe('2026-10-01');
    const s = attendanceSummary([record(1, 'check-in', '2026-10-01T03:00:00Z'), record(2, 'check-out', '2026-10-01T01:00:00Z')], new Date('2026-10-01T04:00:00Z'));
    expect(s.durationMs).toBe(0);
  });
  it('does not count pending outside-office attendance until approved or an office check-in is recorded', () => {
    const outside = { ...record(1, 'check-in', '2026-10-04T00:00:00Z'), location_status: 'outside_office', review_status: 'pending' };
    const office = { ...record(2, 'check-in', '2026-10-04T01:00:00Z'), location_status: 'verified' };
    const pending = attendanceSummary([outside], new Date('2026-10-04T02:00:00Z'));
    expect(pending.checkIn).toBeUndefined();
    expect(pending.daysPresent).toBe(0);
    const retriedAtOffice = attendanceSummary([outside, office], new Date('2026-10-04T02:00:00Z'));
    expect(retriedAtOffice.checkIn?.id).toBe(office.id);
    expect(retriedAtOffice.daysPresent).toBe(1);
    const approved = attendanceSummary([{ ...outside, review_status: 'approved' }], new Date('2026-10-04T02:00:00Z'));
    expect(approved.checkIn?.id).toBe(outside.id);
    expect(approved.daysPresent).toBe(1);
  });
});
