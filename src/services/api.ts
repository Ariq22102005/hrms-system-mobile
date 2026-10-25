import * as Crypto from 'expo-crypto';

import { getAccessToken, removeAccessToken } from './tokenStorage';
import { object, validData, validErrors } from './apiValidation';
import { sameOriginAssetUrl, validateBaseUrl } from './apiConfiguration';

export type FileDto = { id: string | number; name: string; url: string };
export type FacePose = 'front' | 'without_glasses' | 'left' | 'right';
export type FaceCapture = { pose: FacePose; photo_base64: string; captured_at: string };
export type FaceCapturePolicy = { version: 1; require_without_glasses: boolean; verification_endpoint: '/attendance/face-verification' };
export type AttendanceChallenge = { id: string; expires_at: string; office: OfficeDto; face_capture_policy?: FaceCapturePolicy };
export type FaceEnrollmentStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type FaceStatusDto = { status: FaceEnrollmentStatus; rejection_reason: string | null; updated_at: string };
export type FaceEnrollPayload = { challenge_id: string; consent_version: '1'; captures: FaceCapture[] };
export type FaceVerificationDto = { status: 'verified' | 'rejected' | 'retry_required' | 'unavailable' | 'pending'; message: string; verification_id?: string; expires_at?: string };

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string | string[]>;
};

export type EmployeeDto = { id: string; name: string; email: string; role: string; division: string; phone?: string; photo_url?: string; photo_version?: number; employment_start_date?: string; active?: boolean };
export type AttendanceDto = {
  id: string | number;
  type: 'check-in' | 'check-out';
  recorded_at: string;
  latitude: number | null;
  longitude: number | null;
  location_status?: string;
  face_status?: string;
  face_score?: number;
  location_accuracy?: number;
  office_distance_meters?: number;
  outside_office_confirmed?: boolean;
  face_verification_id?: string;
  location_note?: string;
  review_status?: string | null;
  review_note?: string;
  employee_note?: string;
  employee_note_sent_at?: string;
};
export type LeaveRequestDto = {
  id: string | number;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
};
export type OvertimeDto = {
  id: string | number;
  date: string;
  start_time: string;
  end_time: string;
  description: string;
  /** assigned = given by an admin; pending/approved/rejected = requested by the employee. */
  status: string;
  rejection_reason?: string;
  created_at?: string;
};
export type OvertimeRequestPayload = { date: string; start_time: string; end_time: string; description: string };
export type PayrollDto = {
  id: string | number;
  period: string;
  basic_salary: number;
  allowance?: number;
  deductions: number;
  net_salary: number;
  status: string;
  absent_days?: number;
  absent_dates?: string[];
  daily_absence_deduction?: number;
  absence_deduction?: number;
  other_deductions?: number;
  cutoff_date?: string;
};
export type OfficeDto = { latitude: number; longitude: number; radius_meters: number; max_accuracy_meters: number; time_zone: string };
export type LocationSample = { latitude: number; longitude: number; accuracy: number | null; timestamp: number; mocked: boolean | null };
export type NotificationDto = { id: string; type: string; title: string; message: string; created_at: string; read: boolean };
export type DashboardDto = { revision: number; employee: EmployeeDto; attendance: AttendanceDto[]; leaves: LeaveRequestDto[]; overtime: OvertimeDto[]; payroll: PayrollDto[]; notifications: NotificationDto[]; office: OfficeDto };
export type AttendancePayload = {
  type: 'check-in' | 'check-out';
  challenge_id: string;
  location_samples: LocationSample[];
  photo_base64: string;
  captured_at: string;
  outside_office_confirmed?: boolean;
  face_verification_id?: string;
};
export type LeaveRequestPayload = {
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
};

export type ApiErrorCode = 'configuration' | 'timeout' | 'network' | 'invalid_response' | 'http';

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: ApiErrorCode;
  readonly errors?: Record<string, string | string[]>;

  constructor(message: string, code: ApiErrorCode, status: number | null = null, errors?: Record<string, string | string[]>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.errors = errors;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

const environment = process.env.EXPO_PUBLIC_APP_ENV ?? (typeof __DEV__ !== 'undefined' && __DEV__ ? 'development' : 'production');
const developmentUrl = process.env.EXPO_PUBLIC_API_BASE_URL_DEV;
const productionUrl = process.env.EXPO_PUBLIC_API_BASE_URL_PROD;
const sharedUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const stagingUrl = process.env.EXPO_PUBLIC_API_BASE_URL_STAGING;
const mockUrl = process.env.EXPO_PUBLIC_API_BASE_URL_MOCK;
const configuredBaseUrl = (environment === 'production' ? productionUrl : environment === 'staging' ? stagingUrl : environment === 'mock' ? mockUrl : developmentUrl) || sharedUrl || '';
const requestTimeoutMs = 35000;

function getApiRoot(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
}

export function isApiConfigured() {
  return Boolean(configuredBaseUrl.trim());
}

export const API_BASE_URL = configuredBaseUrl.trim().replace(/\/+$/, '');
export function apiAssetUrl(path: string) {
  try { return sameOriginAssetUrl(validateBaseUrl(API_BASE_URL, environment), path); }
  catch (e) { throw new ApiError(e instanceof Error ? e.message : 'URL file tidak valid.', 'configuration'); }
}

export function createRequestId() {
  return Crypto.randomUUID();
}

function errorMessage(status: number, message?: string) {
  if (message) return message;
  if (status === 401) return 'Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.';
  if (status === 403) return 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
  if (status === 404) return 'Data atau endpoint tidak ditemukan.';
  if (status === 422) return 'Periksa kembali data yang dimasukkan.';
  if (status === 400) return 'Permintaan tidak valid. Periksa data Anda.';
  if (status === 429) return 'Terlalu banyak permintaan. Tunggu sebelum mencoba kembali.';
  if (status >= 500) return 'Server sedang bermasalah. Silakan coba lagi nanti.';
  return `Permintaan gagal (${status}).`;
}

function formatErrorMessage(status: number, message?: string, errors?: Record<string, string | string[]>) {
  const details = Object.entries(errors ?? {}).flatMap(([field, value]) =>
    (Array.isArray(value) ? value : [value]).map((detail) => `${field}: ${detail}`),
  );
  return [errorMessage(status, message), ...details].join(' ');
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  authenticated?: boolean;
  idempotencyKey?: string;
  accessToken?: string;
};

export function createApiClient(
  fetcher: typeof fetch = fetch,
  tokenProvider: () => Promise<string | null> = getAccessToken,
  tokenRemover: (expectedToken?: string) => Promise<void> = removeAccessToken,
  baseUrl = configuredBaseUrl,
  timeoutMs = requestTimeoutMs,
  getRetries = 1,
) {
  const inFlightPosts = new Map<string, { fingerprint: string; promise: Promise<unknown> }>();
  async function requestOnce<T>(path: string, options: RequestOptions = {}): Promise<T> {
    let safeBaseUrl: string;
    try { safeBaseUrl = validateBaseUrl(baseUrl, environment); }
    catch (e) { throw new ApiError(e instanceof Error ? e.message : 'API belum dikonfigurasi.', 'configuration'); }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    let token: string | null = null;
    if (options.authenticated !== false) {
      token = options.accessToken ?? await tokenProvider();
      if (!token) {
        unauthorizedHandler?.();
        throw new ApiError('Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.', 'http', 401);
      }
      headers.Authorization = `Bearer ${token}`;
    }
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      let response: Response;
      try {
        response = await fetcher(`${getApiRoot(safeBaseUrl)}${path}`, {
          method: options.method ?? 'GET',
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
          redirect: 'error',
        });
      } catch (error) {
        if (timedOut) throw new ApiError('Koneksi melewati batas waktu. Periksa jaringan lalu coba lagi.', 'timeout');
        throw new ApiError(error instanceof Error ? error.message : 'Tidak dapat terhubung ke server.', 'network');
      }

      let text: string;
      try {
        text = await response.text();
      } catch (error) {
        if (timedOut) throw new ApiError('Koneksi melewati batas waktu. Periksa jaringan lalu coba lagi.', 'timeout');
        throw new ApiError(error instanceof Error ? error.message : 'Respons server tidak dapat dibaca.', 'network');
      }
      let envelope: ApiEnvelope<T> | null = null;
      if (text.trim()) {
        try {
          const parsed: unknown = JSON.parse(text);
          if (object(parsed) && typeof parsed.success === 'boolean' && typeof parsed.message === 'string' && (parsed.errors === undefined || validErrors(parsed.errors))) envelope = parsed as ApiEnvelope<T>;
        } catch {
          if (response.ok) throw new ApiError('Respons server bukan JSON yang valid.', 'invalid_response', response.status);
        }
      }
      if (!response.ok) {
        const message = formatErrorMessage(response.status, envelope?.message, envelope?.errors);
        const apiError = new ApiError(message, 'http', response.status, envelope?.errors);
        if (response.status === 401 && options.authenticated !== false && token === await tokenProvider()) {
          await tokenRemover(token ?? undefined);
          if (!await tokenProvider() || token === await tokenProvider()) unauthorizedHandler?.();
        }
        throw apiError;
      }
      if (!envelope) {
        throw new ApiError('Respons server kosong atau tidak menyertakan field data.', 'invalid_response', response.status);
      }
      if (envelope.success !== true) {
        throw new ApiError(formatErrorMessage(response.status, envelope.message, envelope.errors), 'http', response.status, envelope.errors);
      }
      if (!Object.prototype.hasOwnProperty.call(envelope, 'data')) {
        throw new ApiError('Respons server tidak menyertakan field data.', 'invalid_response', response.status);
      }
      if (!validData(path, envelope.data)) throw new ApiError('Struktur data respons server tidak valid.', 'invalid_response', response.status);
      return envelope.data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const run = async () => {
      const startToken = options.authenticated === false ? null : options.accessToken ?? await tokenProvider();
      for (let attempt = 0; ; attempt++) {
        try { return await requestOnce<T>(path, options); }
        catch (e) {
          const transient = e instanceof ApiError && (['network', 'timeout'].includes(e.code) || [500, 502, 503, 504].includes(e.status ?? 0));
          if (options.method === 'POST' || !transient || attempt >= Math.min(2, Math.max(0, getRetries)) || startToken !== await tokenProvider()) throw e;
          await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
        }
      }
    };
    if (options.method !== 'POST') return run();
    const fingerprint = JSON.stringify(options.body ?? null);
    const key = `${path}:${options.idempotencyKey ?? fingerprint}`;
    const existing = inFlightPosts.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) return Promise.reject(new ApiError('Idempotency key digunakan untuk payload berbeda.', 'http', 409));
      return existing.promise as Promise<T>;
    }
    const promise = run().finally(() => inFlightPosts.delete(key));
    inFlightPosts.set(key, { fingerprint, promise });
    return promise;
  }

  async function getBinary(path: string, maxBytes: number, signal?: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, timeoutMs);
    try {
      const token = await tokenProvider();
      if (!token) throw new ApiError('Sesi berakhir. Masuk kembali.', 'http', 401);
      const url = sameOriginAssetUrl(validateBaseUrl(baseUrl, environment), path);
      const response = await fetcher(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, redirect: 'error' });
      if (!response.ok) {
        if (response.status === 401 && token === await tokenProvider()) { await tokenRemover(token); if (!await tokenProvider() || token === await tokenProvider()) unauthorizedHandler?.(); }
        throw new ApiError(errorMessage(response.status), 'http', response.status);
      }
      if (Number(response.headers.get('content-length')) > maxBytes) throw new ApiError('File melebihi batas ukuran.', 'invalid_response');
      let bytes: Uint8Array<ArrayBuffer>;
      if (response.body?.getReader) {
        const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
        try {
          for (;;) {
            const item = await reader.read(); if (item.done) break;
            size += item.value.byteLength;
            if (size > maxBytes) { await reader.cancel(); throw new ApiError('File melebihi batas ukuran.', 'invalid_response'); }
            chunks.push(item.value);
          }
        } finally { reader.releaseLock(); }
        bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      } else {
        // Native fetch may not expose a stream. Server must enforce Content-Length and upload/download bounds.
        bytes = new Uint8Array(await response.arrayBuffer());
      }
      if (bytes.byteLength > maxBytes) throw new ApiError('File melebihi batas ukuran.', 'invalid_response');
      if (controller.signal.aborted) throw new ApiError('Pengambilan file dibatalkan/melewati batas waktu.', 'timeout');
      if (token !== await tokenProvider()) throw new ApiError('Sesi berubah. File dibatalkan.', 'http', 401);
      return { bytes, contentType: response.headers.get('content-type') ?? '' };
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }

  return {
    getBinary,
    login: (email: string, password: string) => request<{ token: string }>('/auth/login', {
      method: 'POST', authenticated: false, body: { email, password },
    }),
    getEmployee: () => request<EmployeeDto>('/employee'),
    updateEmployee: (payload: { name: string; phone: string }) => request<EmployeeDto>('/employee', { method: 'POST', body: payload }),
    logout: (accessToken?: string) => request<null>('/auth/logout', { method: 'POST', accessToken }),
    getDashboard: () => request<DashboardDto>('/dashboard'),
    getAttendanceChallenge: () => request<AttendanceChallenge>('/attendance/challenge', { method: 'POST' }),
    verifyFace: (payload: { challenge_id: string; consent_version: '1'; captures: FaceCapture[] }, idempotencyKey: string) => request<FaceVerificationDto>('/attendance/face-verification', { method: 'POST', body: payload, idempotencyKey }),
    getFaceStatus: () => request<FaceStatusDto>('/face/status'),
    // The success body is not specified by the contract; callers must treat a missing/odd body as "re-read /face/status".
    enrollFace: (payload: FaceEnrollPayload, idempotencyKey: string) => request<FaceStatusDto | null>('/face/enroll', { method: 'POST', body: payload, idempotencyKey }),
    readNotification: (id: string) => request<NotificationDto>('/notifications/read', { method: 'POST', body: { id } }),
    getAttendance: () => request<AttendanceDto[]>('/attendance'),
    postAttendance: (payload: AttendancePayload, idempotencyKey: string) => request<AttendanceDto>('/attendance', {
      method: 'POST', body: payload, idempotencyKey,
    }),
    postAttendanceClarification: (payload: { attendance_id: string | number; explanation: string }, idempotencyKey: string) => request<AttendanceDto>('/attendance/clarification', {
      method: 'POST', body: payload, idempotencyKey,
    }),
    getLeaveRequests: () => request<LeaveRequestDto[]>('/leave-requests'),
    postLeaveRequest: (payload: LeaveRequestPayload, idempotencyKey: string) => request<LeaveRequestDto>('/leave-requests', {
      method: 'POST', body: payload, idempotencyKey,
    }),
    getOvertime: () => request<OvertimeDto[]>('/overtime'),
    postOvertimeRequest: (payload: OvertimeRequestPayload, idempotencyKey: string) => request<OvertimeDto>('/overtime', { method: 'POST', body: payload, idempotencyKey }),
    getPayroll: () => request<PayrollDto[]>('/payroll'),
    getFiles: () => request<FileDto[]>('/files'),
  };
}

export const api = createApiClient();
