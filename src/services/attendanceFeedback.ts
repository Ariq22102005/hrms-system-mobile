export function attendanceErrorMessage(error: unknown, translate: (key: string) => string) {
  const detail = error instanceof Error ? error.message : translate('saveError');
  const normalized = detail.toLowerCase();
  if (/verification unavailable|verifikasi belum tersedia|backend verification is pending|verifikasi backend masih menunggu/.test(normalized)) return detail;
  if (/outside-office attendance cancelled|absensi di luar kantor dibatalkan/.test(normalized)) return translate('outsideCancelled');
  if (/face|wajah|biometric/.test(normalized)) return `${translate('faceVerificationFailed')}\n${detail}`;
  if (/gps accuracy too low|akurasi gps/.test(normalized)) return `${translate('locationAccuracyFailed')}\n${detail}`;
  if (/approximate location|lokasi saat ini hanya perkiraan/.test(normalized)) return `${translate('preciseLocationPermission')}\n${detail}`;
  if (/gps|location|lokasi|coordinate|koordinat|accuracy|akurasi|mock location|outside office/.test(normalized)) {
    return `${translate('locationVerificationFailed')}\n${detail}`;
  }
  if (/camera|photo|foto/.test(normalized)) return `${translate('cameraVerificationFailed')}\n${detail}`;
  return detail;
}
