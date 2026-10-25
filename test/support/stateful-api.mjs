// Test-only in-memory contract fixture. No biometric matching or production persistence.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
export function createFixtureServer() {
  const employee = { id: 'EMP-QA', name: 'QA Employee', email: 'qa@example.test', role: 'Staff', division: 'QA' };
  const office = { latitude: -3.8, longitude: 102.2, radius_meters: 100, max_accuracy_meters: 50, time_zone: 'Asia/Jakarta' };
  const state = { revision: 1, employee, office, attendance: [], leaves: [], overtime: [{ id: 'OT-QA', date: '2026-10-12', start_time: '17:00', end_time: '18:00', description: 'QA assignment', status: 'assigned' }], payroll: [{ id: 'PAY-QA', period: '2026-10', basic_salary: 1000000, deductions: 0, net_salary: 1000000, status: 'processed' }], notifications: [] };
  // Face enrollment fixture: approved by default so attendance browser tests keep working; enroll moves it to pending.
  const face = { status: 'approved', rejection_reason: null, updated_at: new Date().toISOString() };
  const sessions = new Set(); const operations = new Map();
  return createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8082');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    const send = (data, status = 200, message = 'Test fixture response') => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: status < 400, message, data })); };
    try {
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 12000000) { send(null, 413); return; } }
      const body = raw ? JSON.parse(raw) : {};
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/api/v1/auth/login') {
        if (body.email !== employee.email || body.password !== 'fixture-only-password') { send(null, 401, 'Invalid test credentials'); return; }
        const token = randomUUID(); sessions.add(token); send({ token }); return;
      }
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      if (!sessions.has(token)) { send(null, 401, 'Test session expired'); return; }
      if (path === '/api/v1/auth/logout') { sessions.delete(token); send(null); return; }
      const key = `${token}:${path}:${req.headers['idempotency-key']}`;
      if (req.method === 'POST' && operations.has(key)) {
        const existing = operations.get(key);
        if (existing.raw !== raw) send(null, 409); else send(existing.data);
        return;
      }
      if (path === '/api/v1/employee') {
        if (req.method === 'POST') { employee.name = body.name; employee.phone = body.phone; state.revision++; }
        send(employee); return;
      }
      if (path === '/api/v1/dashboard') { send(state); return; }
      if (path === '/api/v1/attendance/challenge') { send({ id: randomUUID(), expires_at: new Date(Date.now() + 90000).toISOString(), office }); return; }
      if (path === '/api/v1/attendance') {
        if (req.method === 'GET') { send(state.attendance); return; }
        // Deliberately pending: test capture completion never authorizes biometric attendance.
        const record = { id: randomUUID(), type: body.type, recorded_at: new Date().toISOString(), latitude: office.latitude, longitude: office.longitude, face_status: 'pending', location_status: 'pending' };
        state.attendance.unshift(record); state.revision++; operations.set(key, { raw, data: record }); send(record, 201); return;
      }
      if (path === '/api/v1/leave-requests') {
        if (req.method === 'GET') { send(state.leaves); return; }
        const record = { ...body, id: randomUUID(), status: 'pending', created_at: new Date().toISOString() };
        state.leaves.unshift(record); state.revision++; operations.set(key, { raw, data: record }); send(record, 201); return;
      }
      if (path === '/api/v1/face/status') { send(face); return; }
      if (path === '/api/v1/face/enroll') {
        const poses = (body.captures ?? []).map((c) => c.pose).join(',');
        if (body.consent_version !== '1' || poses !== 'front,left,right') { send(null, 422, 'Pendaftaran wajah tidak valid.'); return; }
        Object.assign(face, { status: 'pending', rejection_reason: null, updated_at: new Date().toISOString() });
        operations.set(key, { raw, data: face }); send(face, 201); return;
      }
      if (path === '/api/v1/overtime') { send(state.overtime); return; }
      if (path === '/api/v1/payroll') { send(state.payroll); return; }
      if (path === '/api/v1/files') { send([]); return; }
      send(null, 404);
    } catch { send(null, 400); }
  });
}
