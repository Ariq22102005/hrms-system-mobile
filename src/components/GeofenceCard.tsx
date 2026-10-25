import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import type { LocationSample, OfficeDto } from '../services/api';
import { geofenceMapHtml, geofencePreview } from '../services/geofence';
import GeofenceMap from './GeofenceMap';
import StatusNotice from './StatusNotice';

export default function GeofenceCard({ office, now, disabled, serverError }: { office: OfficeDto; now: Date; disabled: boolean; serverError: boolean }) {
  const { colors } = useTheme(); const { language } = useLanguage(); const en = language === 'en';
  const [sample, setSample] = useState<LocationSample | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const operation = useRef(0); const lock = useRef(false);
  useFocusEffect(useCallback(() => () => { operation.current++; lock.current = false; setBusy(false); setSample(null); setError(null); }, []));
  const result = geofencePreview(sample, office, now.getTime());
  const html = useMemo(() => geofenceMapHtml(office, sample), [office.latitude, office.longitude, office.radius_meters, sample]);
  async function locate() {
    if (lock.current || disabled || serverError) return;
    lock.current = true; const version = ++operation.current; setBusy(true); setError(null); setSample(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (version !== operation.current) return;
      if (!permission.granted) throw new Error(en ? 'Allow precise location to check your area.' : 'Izinkan lokasi presisi untuk memeriksa area Anda.');
      const location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, ...(Platform.OS === 'web' ? { maximumAge: 0, timeout: 20000 } : {}) }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(en ? 'GPS timed out. Try again outdoors.' : 'GPS belum terbaca. Coba lagi di area terbuka.')), 20000); }),
      ]);
      if (version !== operation.current) return;
      setSample({ latitude: location.coords.latitude, longitude: location.coords.longitude, accuracy: location.coords.accuracy, timestamp: location.timestamp, mocked: location.mocked ?? null });
    } catch (e) { if (version === operation.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (timer) clearTimeout(timer); if (version === operation.current) { lock.current = false; setBusy(false); } }
  }
  const label = serverError ? (en ? 'Office data is not synchronized' : 'Data kantor belum tersinkron')
    : result.status === 'inside' ? (en ? 'Inside office area' : 'Di dalam area kantor')
    : result.status === 'outside' ? (en ? 'Outside office · HR review required' : 'Di luar kantor · perlu tinjauan HR')
    : result.status === 'unreliable' ? (en ? 'Refresh GPS · location expired or inaccurate' : 'Perbarui GPS · lokasi kedaluwarsa atau kurang akurat')
    : (en ? 'Check your GPS location' : 'Periksa lokasi GPS Anda');
  return <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 18 }}>
    <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}>{en ? 'GPS verification' : 'Verifikasi GPS'}</Text>
    <Text style={{ color: colors.muted, lineHeight: 19, fontSize: 12, marginTop: 6 }}>{en ? 'Office area from server' : 'Area kantor dari server'} · {office.radius_meters} m</Text>
    <StatusNotice tone={!serverError && result.status === 'inside' ? 'success' : 'warning'}>{label}</StatusNotice>
    <View style={{ overflow: 'hidden', borderRadius: 16 }}><GeofenceMap html={html} /></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
      {[[en ? 'DISTANCE' : 'JARAK', result.distance == null ? '—' : `${Math.round(result.distance)} m`], [en ? 'GPS ACCURACY' : 'AKURASI GPS', sample?.accuracy == null ? '—' : `± ${Math.round(sample.accuracy)} m`], [en ? 'ACCURACY LIMIT' : 'BATAS AKURASI', `${office.max_accuracy_meters} m`]].map(([title, value]) => <View key={title} style={{ flexGrow: 1, flexBasis: 80, padding: 10, backgroundColor: colors.background, borderRadius: 12 }}><Text style={{ color: colors.muted, fontSize: 9, fontWeight: '700' }}>{title}</Text><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15, marginTop: 6 }}>{value}</Text></View>)}
    </View>
    {error ? <StatusNotice tone="danger">{error}</StatusNotice> : null}
    <Pressable accessibilityRole="button" disabled={busy || disabled || serverError} onPress={() => void locate()} style={{ minHeight: 48, backgroundColor: colors.primarySoft, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 14, opacity: busy || disabled || serverError ? 0.6 : 1 }}>
      {busy ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accent, fontWeight: '800' }}>{en ? 'Refresh GPS' : 'Perbarui GPS'}</Text>}
    </Pressable>
    <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 12 }}>{en ? 'Location preview only. Attendance checks fresh GPS and is verified by the server. Outside the area? You can continue for HR review.' : 'Pratinjau lokasi. Absensi memakai GPS baru dan diverifikasi server. Di luar area? Anda dapat melanjutkan untuk ditinjau HR.'}</Text>
  </View>;
}
