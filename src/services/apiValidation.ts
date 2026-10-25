// Validate untrusted JSON at the network boundary; extra backend fields remain compatible.
type JsonObject = Record<string, unknown>;
export const object = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (v: unknown) => typeof v === 'string';
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const id = (v: unknown) => (text(v) && Boolean(v)) || number(v);
const fields = (v: unknown, keys: string[]) => object(v) && keys.every((k) => text(v[k]));
const timestamp = (v: unknown) => text(v) && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v as string) && Number.isFinite(Date.parse(v as string));
const optional = (v: JsonObject, key: string, check: (v: unknown) => boolean) => v[key] === undefined || check(v[key]);
export const employee = (v: unknown): boolean => fields(v, ['id', 'name', 'email', 'role', 'division']) && object(v) && Boolean(v.id) && optional(v, 'photo_url', text) && optional(v, 'phone', text) && optional(v, 'photo_version', number) && optional(v, 'active', (x) => typeof x === 'boolean');
export const attendance = (v: unknown): boolean => object(v) && id(v.id) && ['check-in', 'check-out'].includes(v.type as string) && timestamp(v.recorded_at)
  && [v.latitude, v.longitude].every((x) => x === null || number(x)) && ['face_status', 'location_status', 'review_note', 'employee_note'].every((k) => optional(v, k, text)) && optional(v, 'review_status', (x) => x === null || text(x));
const leave = (v: unknown) => fields(v, ['leave_type', 'start_date', 'end_date', 'reason', 'status']) && object(v) && id(v.id) && timestamp(v.created_at);
const overtime = (v: unknown) => fields(v, ['date', 'start_time', 'end_time', 'description', 'status']) && object(v) && id(v.id);
const payroll = (v: unknown) => fields(v, ['period', 'status']) && object(v) && id(v.id) && ['basic_salary', 'deductions', 'net_salary'].every((k) => number(v[k])) && optional(v, 'allowance', number);
const notification = (v: unknown) => fields(v, ['id', 'type', 'title', 'message']) && object(v) && timestamp(v.created_at) && typeof v.read === 'boolean';
export function office(v: unknown): boolean {
  if (!object(v) || !number(v.latitude) || !number(v.longitude) || Math.abs(v.latitude as number) > 90 || Math.abs(v.longitude as number) > 180 || !number(v.radius_meters) || (v.radius_meters as number) <= 0 || !number(v.max_accuracy_meters) || (v.max_accuracy_meters as number) <= 0 || !text(v.time_zone)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: v.time_zone as string }); return true; } catch { return false; }
}
const list = (v: unknown, check: (v: unknown) => boolean) => Array.isArray(v) && v.every(check);
export const file = (v: unknown) => fields(v, ['name', 'url']) && object(v) && id(v.id);
export const faceStatuses = ['none', 'pending', 'approved', 'rejected'] as const;
export const faceStatus = (v: unknown): boolean => object(v) && (faceStatuses as readonly string[]).includes(v.status as string)
  && (v.rejection_reason === undefined || v.rejection_reason === null || text(v.rejection_reason)) && text(v.updated_at);
export function validData(path: string, value: unknown): boolean {
  switch (path) {
    case '/auth/login': return object(value) && typeof value.token === 'string' && value.token.trim().length > 0;
    case '/auth/logout': return value === null;
    case '/employee': return employee(value);
    case '/dashboard': return object(value) && number(value.revision) && employee(value.employee) && office(value.office)
      && list(value.attendance, attendance) && list(value.leaves, leave) && list(value.overtime, overtime) && list(value.payroll, payroll) && list(value.notifications, notification);
    case '/attendance/challenge': return object(value) && text(value.id) && Boolean(value.id) && timestamp(value.expires_at) && office(value.office)
      && (value.face_capture_policy === undefined || (object(value.face_capture_policy) && value.face_capture_policy.version === 1 && typeof value.face_capture_policy.require_without_glasses === 'boolean' && value.face_capture_policy.verification_endpoint === '/attendance/face-verification'));
    case '/attendance/face-verification': return object(value) && ['verified', 'rejected', 'retry_required', 'unavailable', 'pending'].includes(value.status as string)
      && text(value.message) && (value.status !== 'verified' || (text(value.verification_id) && Boolean(value.verification_id) && timestamp(value.expires_at)));
    case '/face/status': return faceStatus(value);
    // Enroll success body is unspecified: accept null, or any object (the app re-reads /face/status either way).
    case '/face/enroll': return value === null || object(value);
    case '/attendance/clarification': return attendance(value);
    case '/notifications/read': return notification(value);
    case '/attendance': return Array.isArray(value) ? list(value, attendance) : attendance(value);
    case '/leave-requests': return Array.isArray(value) ? list(value, leave) : leave(value);
    case '/overtime': return Array.isArray(value) ? list(value, overtime) : overtime(value);
    case '/payroll': return list(value, payroll);
    case '/files': return list(value, file);
    default: return false;
  }
}
export function validErrors(value: unknown): value is Record<string, string | string[]> {
  return object(value) && Object.values(value).every((v) => text(v) || (Array.isArray(v) && v.every(text)));
}
