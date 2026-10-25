import { describe, expect, it } from 'vitest';
import { attendanceErrorMessage } from './attendanceFeedback';

const translate = (key: string) => ({
  saveError: 'Tidak dapat menyimpan.',
  outsideCancelled: 'Check-in dibatalkan.',
  faceVerificationFailed: 'Verifikasi wajah gagal.',
  locationVerificationFailed: 'Verifikasi GPS gagal.',
  locationAccuracyFailed: 'Sinyal GPS belum cukup akurat.',
  preciseLocationPermission: 'Izin lokasi masih perkiraan.',
  cameraVerificationFailed: 'Kamera gagal.',
}[key] ?? key);

describe('attendance failure feedback', () => {
  it('shows explicit face-verification guidance and server detail', () => {
    expect(attendanceErrorMessage(new Error('Face does not match employee profile'), translate))
      .toBe('Verifikasi wajah gagal.\nFace does not match employee profile');
    expect(attendanceErrorMessage(new Error('Face engine unavailable'), translate))
      .toContain('Verifikasi wajah gagal.');
  });

  it('distinguishes an inaccurate GPS fix from approximate location permission', () => {
    expect(attendanceErrorMessage(new Error('GPS accuracy too low / Akurasi GPS ±76 m, batas 100 m.'), translate))
      .toContain('Sinyal GPS belum cukup akurat.');
    expect(attendanceErrorMessage(new Error('Approximate location permission'), translate))
      .toContain('Izin lokasi masih perkiraan.');
    for (const detail of ['Location permission required', 'Location timed out']) {
      expect(attendanceErrorMessage(new Error(detail), translate)).toContain('Verifikasi GPS gagal.');
    }
  });

  it('preserves cancellation and explains camera failures without misclassifying other errors', () => {
    expect(attendanceErrorMessage(new Error('Outside-office attendance cancelled'), translate)).toBe('Check-in dibatalkan.');
    expect(attendanceErrorMessage(new Error('Photo expired'), translate)).toContain('Kamera gagal.');
    expect(attendanceErrorMessage(new Error('Network request failed'), translate)).toBe('Network request failed');
  });
});
