import { AttendanceDto } from './api';
export function dateKey(date: Date, timeZone = 'Asia/Jakarta') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function isAttendanceCounted(record: AttendanceDto) {
  if (record.face_status && !['matched', 'verified'].includes(record.face_status)) return false;
  if (record.location_status && !['verified', 'outside_office'].includes(record.location_status)) return false;
  return record.location_status !== 'outside_office' || record.review_status === 'approved';
}
export function attendanceVerificationLabel(record: AttendanceDto) {
  if (['matched', 'verified'].includes(record.face_status ?? '')) return record.location_status === 'verified' ? 'serverVerified' : 'faceVerified';
  return record.face_status ? 'verificationPending' : 'legacyAttendance';
}
export function attendanceSummary(records: AttendanceDto[], now = new Date(), timeZone = 'Asia/Jakarta') {
  const today = dateKey(now, timeZone);
  const days = new Map<string, { checkIn?: AttendanceDto; checkOut?: AttendanceDto }>();
  for (const record of records) {
    if (!isAttendanceCounted(record)) continue;
    const date = new Date(record.recorded_at);
    if (!Number.isFinite(date.getTime())) continue;
    const key = dateKey(date, timeZone);
    const pair = days.get(key) ?? {};
    if (record.type === 'check-in' && (!pair.checkIn || record.recorded_at < pair.checkIn.recorded_at)) pair.checkIn = record;
    if (record.type === 'check-out' && (!pair.checkOut || record.recorded_at > pair.checkOut.recorded_at)) pair.checkOut = record;
    days.set(key, pair);
  }
  const duration = (pair: { checkIn?: AttendanceDto; checkOut?: AttendanceDto }, current: boolean) => {
    if (!pair.checkIn || (!pair.checkOut && !current)) return 0;
    const end = pair.checkOut ? new Date(pair.checkOut.recorded_at).getTime() : now.getTime();
    return Math.max(0, end - new Date(pair.checkIn.recorded_at).getTime());
  };
  const current = days.get(today) ?? {};
  const month = [...days].filter(([key]) => key.slice(0, 7) === today.slice(0, 7));
  return { ...current, durationMs: duration(current, true), daysPresent: month.filter(([, pair]) => pair.checkIn).length, monthlyMs: month.reduce((sum, [key, pair]) => sum + duration(pair, key === today), 0) };
}
export const formatDuration = (ms: number) => `${Math.floor(ms / 3600000)}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}`;
