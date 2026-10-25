import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import AttendanceSummaryCard from '../components/AttendanceSummaryCard';
import GeofenceCard from '../components/GeofenceCard';
import StatusNotice, { NoticeTone } from '../components/StatusNotice';
import FaceStatusCard from '../components/FaceStatusCard';
import FaceLivenessCameraLoader from '../components/FaceLivenessCameraLoader';
import { useFaceStatus } from '../context/FaceStatusContext';
import type { EmployeeTabParamList } from '../navigation/AppNavigator';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { api, ApiError, AttendancePayload, createRequestId, FaceCapture, FaceCapturePolicy, FacePose, LocationSample, OfficeDto } from '../services/api';
import { facePoses, makeFaceCapture, removeTemporaryPhoto, requireCaptures } from '../services/faceCapture';
import { officeDistance } from '../services/officeLocation';
import { attendanceErrorMessage } from '../services/attendanceFeedback';
import { useClock } from '../services/useClock';
import { attendanceSummary, attendanceVerificationLabel, dateKey } from '../services/attendanceSummary';
// Attendance screen visual system: deep wine, vivid red and soft rose surfaces.
const attendanceGradient = 'linear-gradient(135deg, #30070D 0%, #760B18 48%, #C4202F 100%)';
const accentGradient = 'linear-gradient(135deg, #8B0D1A 0%, #C4202F 100%)';
const gradient = (value: string) => ({ experimental_backgroundImage: value }) as const;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('GPS timed out / GPS belum terbaca. Pastikan GPS aktif lalu coba lagi.')), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}
async function readLocation(maxAccuracy = 50): Promise<LocationSample> {
  const result = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, ...(Platform.OS === 'web' ? { maximumAge: 0, timeout: 20000 } : {}) }), 20000);
  if (result.mocked) throw new Error('Mock location rejected / Lokasi palsu ditolak.');
  const accuracy = result.coords.accuracy;
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy <= 0) throw new Error('GPS accuracy unavailable / GPS belum melaporkan akurasi. Coba lagi di area terbuka.');
  if (accuracy > maxAccuracy) throw new Error(`GPS accuracy too low / Akurasi GPS ±${Math.round(accuracy)} m, batas ${Math.round(maxAccuracy)} m. Tunggu sinyal GPS stabil di area terbuka lalu coba lagi.`);
  if (Date.now() - result.timestamp > 45000) throw new Error('GPS expired / Lokasi sudah kedaluwarsa.');
  return { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy, timestamp: result.timestamp, mocked: result.mocked ?? null };
}
export default function AttendanceScreen() {
  const { data, error, refresh } = useData(); const { t, language } = useLanguage();
  const { faceStatus, refresh: refreshFaceStatus } = useFaceStatus(); const navigation = useNavigation<BottomTabNavigationProp<EmployeeTabParamList>>();
  const faceApproved = faceStatus === 'approved'; const { colors } = useTheme(); const insets = useSafeAreaInsets();
  const now = useClock(); const summary = attendanceSummary(data?.attendance ?? [], now, data?.office.time_zone);
  const camera = useRef<CameraView>(null); const [, requestCameraPermission] = useCameraPermissions();
  const [visible, setVisible] = useState(false); const [ready, setReady] = useState(false); const [pictureSize, setPictureSize] = useState<string>();
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'camera' | 'capturing' | 'saving'>('idle');
  const [consentVisible, setConsentVisible] = useState(false);
  const [captureStep, setCaptureStep] = useState(0);
  const captures = useRef<FaceCapture[]>([]);
  const retentionDeadline = useRef(0);
  const [policy, setPolicy] = useState<FaceCapturePolicy>();
  const [message, setMessage] = useState<string | null>(null); const [permissionDenied, setPermissionDenied] = useState(false);
  const [messageTone, setMessageTone] = useState<NoticeTone>('warning');
  const [retryAvailable, setRetryAvailable] = useState(false);
  const lock = useRef(false); const operation = useRef(0);
  // Native builds capture every pose automatically (liveness camera, no shutter button). The browser keeps the manual camera.
  const auto = Platform.OS !== 'web';
  const steps: FacePose[] = auto && !policy?.require_without_glasses ? ['front', 'left', 'right'] : facePoses;
  const lastStep = steps.length - 1;
  const autoErrorHandler = useRef<(message: string, kind?: 'permission' | 'camera' | 'capture') => void>(() => undefined);
  const onAutoError = useCallback((message: string, kind?: 'permission' | 'camera' | 'capture') => autoErrorHandler.current(message, kind), []);
  const [outsidePrompt, setOutsidePrompt] = useState<{ sample: LocationSample; distance: number } | null>(null);
  const outsideDecision = useRef<((confirmed: boolean) => void) | null>(null);
  const captureData = useRef<{ challenge: string; first: LocationSample; maxAccuracy: number; expiresAt: number; office: OfficeDto; outsideConfirmed: boolean; policy?: FaceCapturePolicy } | null>(null);
  const pending = useRef<{ key: string; payload: AttendancePayload } | null>(null);
  const pendingClarification = useRef<{ id: string | number; key: string; explanation: string } | null>(null);
  const [clarification, setClarification] = useState<{ id: string | number; value: string } | null>(null);
  const [sendingClarification, setSendingClarification] = useState(false);
  const outsideCheckInPending = data?.attendance.some((record) => record.type === 'check-in'
    && record.location_status === 'outside_office'
    && record.review_status !== 'approved'
    && dateKey(new Date(record.recorded_at), data.office.time_zone) === dateKey(now, data.office.time_zone)) ?? false;
  useFocusEffect(useCallback(() => () => {
    operation.current++; captureData.current = null; captures.current = []; pending.current = null; lock.current = false; setVisible(false); setConsentVisible(false); setRetryAvailable(false); setPhase('idle'); outsideDecision.current?.(false); outsideDecision.current = null; setOutsidePrompt(null);
  }, []));
  useEffect(() => {
    if (phase === 'idle' && !retryAvailable) return;
    if (!retentionDeadline.current) return;
    const timer = setTimeout(() => {
      operation.current++; captures.current = []; captureData.current = null; pending.current = null;
      lock.current = false; setVisible(false); setPhase('idle'); setRetryAvailable(false); decideOutside(false);
      setMessageTone('warning'); setMessage(t('captureExpired'));
    }, Math.max(0, retentionDeadline.current - Date.now()));
    return () => clearTimeout(timer);
  }, [phase, visible, retryAvailable, t]);
  const button = { minHeight: 52, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: '#8B0D1A', ...gradient(accentGradient), marginTop: 12, paddingHorizontal: 18, paddingVertical: 13, shadowColor: '#5C0711', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 };
  function decideOutside(confirmed: boolean) {
    const resolve = outsideDecision.current; outsideDecision.current = null; setOutsidePrompt(null); resolve?.(confirmed);
  }
  function confirmOutside(sample: LocationSample, office: OfficeDto): Promise<boolean> {
    setOutsidePrompt({ sample, distance: officeDistance(sample, office) });
    return new Promise((resolve) => { outsideDecision.current = resolve; });
  }
  async function submit(version: number) {
    if (!pending.current) return;
    setPhase('saving'); setRetryAvailable(false);
    try {
      const submitted = pending.current;
      const result = await api.postAttendance(submitted.payload, submitted.key);
      if (version !== operation.current) return;
      pending.current = null; captureData.current = null; captures.current = [];
      if (result.type !== submitted.payload.type) throw new ApiError('Jenis absensi respons tidak sesuai permintaan.', 'invalid_response');
      setMessageTone(['matched', 'verified'].includes(result.face_status ?? '') && (result.location_status === 'verified' || result.review_status === 'approved') ? 'success' : 'warning');
      setMessage(!['matched', 'verified'].includes(result.face_status ?? '') ? t('verificationPending') : result.location_status === 'outside_office' && result.review_status !== 'approved' ? t('outsidePending') : result.location_status === 'verified' || result.review_status === 'approved' ? t('attendanceSaved') : t('verificationPending'));
      await refresh(true);
    } catch (e) {
      if (version !== operation.current) return;
      if (e instanceof ApiError && e.code === 'http' && e.status && e.status < 500 && e.status !== 429) { pending.current = null; captures.current = []; await refresh(); }
      setMessageTone('danger'); setMessage(attendanceErrorMessage(e, t));
      setRetryAvailable(Boolean(pending.current));
    } finally { if (version === operation.current) { lock.current = false; setPhase('idle'); } }
  }
  // Face attendance needs an approved enrollment: never open the camera for any other status.
  function blockUnlessApproved(): boolean {
    if (faceApproved) return false;
    setMessageTone('warning');
    setMessage(t(faceStatus === 'pending' ? 'feAttendanceBlockedPending' : faceStatus === 'rejected' ? 'feAttendanceBlockedRejected' : faceStatus === 'none' ? 'feAttendanceBlockedNone' : 'feAttendanceBlockedUnknown'));
    if (!faceStatus) void refreshFaceStatus();
    return true;
  }
  async function begin() {
    if (!pending.current && blockUnlessApproved()) return;
    if (lock.current || phase !== 'idle' || !data || error || summary.checkOut) return;
    if (!pending.current) retentionDeadline.current = Date.now() + 120000;
    lock.current = true; const version = ++operation.current; setPhase('preparing'); setMessage(null); setPermissionDenied(false);
    if (pending.current) { await submit(version); return; }
    try {
      const cameraPermission = await requestCameraPermission();
      const gpsPermission = await Location.requestForegroundPermissionsAsync();
      if (!cameraPermission.granted || !gpsPermission.granted) { setPermissionDenied(true); throw new Error(t(!cameraPermission.granted ? 'cameraPermissionTitle' : 'locationPermissionTitle')); }
      const approximateLocation = (Platform.OS === 'android' && gpsPermission.android?.accuracy === 'coarse')
        || (Platform.OS === 'ios' && gpsPermission.ios?.accuracy === 'reduced');
      if (approximateLocation) { setPermissionDenied(true); throw new Error(t('preciseLocationPermission')); }
      const challenge = await api.getAttendanceChallenge();
      if (version !== operation.current) return;
      const first = await readLocation(challenge.office.max_accuracy_meters);
      if (version !== operation.current) return;
      const outside = officeDistance(first, challenge.office) > challenge.office.radius_meters;
      const confirmed = outside ? await confirmOutside(first, challenge.office) : false;
      if (version !== operation.current) return;
      if (outside && !confirmed) throw new Error(t('outsideCancelled'));
      // Confirmation may take time; capture still must use the original fresh
      // GPS sample and challenge. The server also enforces these bounds.
      if (Date.now() - first.timestamp > 45000 || Date.now() > Date.parse(challenge.expires_at)) throw new Error('Verification expired / Verifikasi kedaluwarsa. Ulangi absensi.');
      captureData.current = { challenge: challenge.id, first, maxAccuracy: challenge.office.max_accuracy_meters, expiresAt: Date.parse(challenge.expires_at), office: challenge.office, outsideConfirmed: confirmed, policy: challenge.face_capture_policy };
      captures.current = []; setCaptureStep(0); setPolicy(challenge.face_capture_policy);
      retentionDeadline.current = Date.now() + 120000;
      setReady(false); setPictureSize(undefined); setVisible(true);
      setPhase('camera'); lock.current = false;
    } catch (e) {
      if (version !== operation.current) return;
      setVisible(false); setMessageTone('danger'); setMessage(attendanceErrorMessage(e, t)); setPhase('idle'); lock.current = false;
    }
  }
  async function cameraReady() {
    const version = operation.current;
    try {
      const sizes = await camera.current?.getAvailablePictureSizesAsync();
      const size = sizes?.map((s) => ({ s, width: Number(s.split('x')[0]) })).filter((s) => s.width >= 640 && s.width <= 1280).sort((a, b) => a.width - b.width)[0]?.s;
      if (size && version === operation.current) setPictureSize(size);
    } catch { /* Camera can use its default size. */ }
    if (Platform.OS === 'web') {
      const deadline = Date.now() + 10000;
      while (version === operation.current && Date.now() < deadline) {
        const video = document.querySelector('video');
        if (video && video.readyState >= 2 && video.videoWidth > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (version !== operation.current) return;
      const video = document.querySelector('video');
      if (!video || video.readyState < 2 || video.videoWidth === 0) { setMessageTone('danger'); setMessage(t('photoError')); cancel(); return; }
    }
    if (version === operation.current) setReady(true);
  }
  function cancel() {
    if (phase === 'saving') return;
    operation.current++; captureData.current = null; captures.current = []; pending.current = null; lock.current = false; setVisible(false); setConsentVisible(false); setRetryAvailable(false); setPhase('idle');
    decideOutside(false);
  }
  async function sendClarification() {
    if (!clarification || sendingClarification || !clarification.value.trim()) return;
    setSendingClarification(true); setMessage(null);
    try {
      const explanation = clarification.value.trim();
      if (pendingClarification.current?.id !== clarification.id || pendingClarification.current.explanation !== explanation) {
        pendingClarification.current = { id: clarification.id, explanation, key: createRequestId() };
      }
      await api.postAttendanceClarification({ attendance_id: clarification.id, explanation }, pendingClarification.current.key);
      pendingClarification.current = null;
      setClarification(null); setMessageTone('success'); setMessage(t('clarificationSent')); await refresh(true);
    } catch (e) { setMessageTone('danger'); setMessage(attendanceErrorMessage(e, t)); }
    finally { setSendingClarification(false); }
  }
  // Shared by the manual (web) and automatic (native) camera: take one photo, then continue the guided workflow.
  async function runCapture(getPhoto: () => Promise<{ base64: string; capturedAt: string }>) {
    if (lock.current || !captureData.current) return;
    lock.current = true; const version = operation.current; setPhase('capturing');
    try {
      const context = captureData.current;
      if (Date.now() > context.expiresAt) throw new Error(t('captureExpired'));
      const { base64, capturedAt } = await getPhoto();
      if (version !== operation.current) return;
      captures.current.push(makeFaceCapture(steps[captureStep], base64, capturedAt));
      if (captureStep < lastStep) { setCaptureStep(captureStep + 1); setPhase('camera'); lock.current = false; return; }
      const photos = requireCaptures(captures.current, context.policy);
      setVisible(false);
      setPhase('saving');
      let verificationId: string | undefined;
      let verificationExpires = Number.POSITIVE_INFINITY;
      if (context.policy) {
        let verified;
        try { verified = await api.verifyFace({ challenge_id: context.challenge, consent_version: '1', captures: photos }, createRequestId()); }
        catch (e) {
          if (e instanceof ApiError && (['network', 'timeout'].includes(e.code) || [404, 500, 502, 503, 504].includes(e.status ?? 0))) throw new Error(t('faceUnavailable'));
          throw e;
        }
        if (version !== operation.current) return;
        if (verified.status !== 'verified') throw new Error(`${t(verified.status === 'rejected' ? 'faceRejected' : verified.status === 'retry_required' ? 'faceRetry' : verified.status === 'pending' ? 'facePending' : 'faceUnavailable')} ${verified.message}`);
        if (!verified.verification_id || !verified.expires_at || Date.parse(verified.expires_at) <= Date.now()) throw new Error(t('captureExpired'));
        verificationId = verified.verification_id;
        verificationExpires = Date.parse(verified.expires_at);
      }
      // Read two fresh samples after the guided workflow, preserving the existing POST contract.
      const first = await readLocation(context.maxAccuracy);
      if (version !== operation.current) return;
      const second = await readLocation(context.maxAccuracy);
      if (version !== operation.current) return;
      if ([first, second].some((sample) => officeDistance(sample, context.office) > context.office.radius_meters) && !context.outsideConfirmed) {
        const confirmed = await confirmOutside(second, context.office);
        if (version !== operation.current) return;
        if (!confirmed) throw new Error(t('outsideCancelled'));
        context.outsideConfirmed = true;
      }
      if (Date.now() > context.expiresAt || Date.now() >= verificationExpires) throw new Error(t('captureExpired'));
      const front = photos.find((p) => p.pose === 'front')!;
      pending.current = { key: createRequestId(), payload: { type: summary.checkIn ? 'check-out' : 'check-in', challenge_id: context.challenge, location_samples: [first, second], photo_base64: front.photo_base64, captured_at: front.captured_at, outside_office_confirmed: context.outsideConfirmed, ...(verificationId ? { face_verification_id: verificationId } : {}) } };
      captures.current = [];
      await submit(version);
    } catch (e) {
      if (version !== operation.current) return;
      captures.current = []; captureData.current = null;
      setVisible(false); setMessageTone('danger'); setMessage(attendanceErrorMessage(e, t)); setPhase('idle'); lock.current = false;
    }
  }
  async function capture() {
    if (!ready || !camera.current) return;
    await runCapture(async () => {
      const picture = await camera.current!.takePictureAsync({ quality: 0.4, base64: true, skipProcessing: false });
      const capturedAt = new Date().toISOString();
      // Delete Expo's cached photo even if the screen/session changed during capture.
      try { await removeTemporaryPhoto(picture?.uri); }
      catch { throw new Error(t('photoCleanupFailed')); }
      if (!picture?.base64) throw new Error(t('photoError'));
      return { base64: picture.base64, capturedAt };
    });
  }
  autoErrorHandler.current = (message, kind) => {
    if (kind === 'permission') setPermissionDenied(true);
    setMessageTone('danger'); setMessage(message); cancel();
  };
  return <ScrollView style={{ backgroundColor: colors.background }} showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 36, flexGrow: 1, backgroundColor: colors.background }}>
    {/* Branded hero header — redesigned layout, same screen strings and behavior. */}
    <View style={{ backgroundColor: '#760B18', ...gradient(attendanceGradient), paddingTop: insets.top + 18, paddingHorizontal: 22, paddingBottom: 48, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden' }}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', right: -70, top: -85, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }} />
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', right: 30, bottom: -95, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.045)' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
        <View style={{ width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
          <Ionicons name="finger-print-outline" size={23} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.76)', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 }}>{t('attendanceEyebrow').toUpperCase()}</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 25, fontWeight: '800', letterSpacing: -0.6, marginTop: 3 }}>{t('attendanceTitle')}</Text>
        </View>
        <View style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{faceApproved ? 'READY' : 'ACTION'}</Text>
        </View>
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', lineHeight: 23, maxWidth: 300 }}>{t('oneStepAttendance')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 16, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)' }}>
        <Ionicons name="calendar-outline" size={15} color="#FFE7E9" />
        <Text style={{ color: '#FFE7E9', fontSize: 12, fontWeight: '600', marginLeft: 8 }}>{now.toLocaleDateString(language === 'en' ? 'en-GB' : 'id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: data?.office.time_zone ?? 'Asia/Jakarta' })}</Text>
      </View>
    </View>

    {/* Main action card overlaps the hero to establish a clear visual hierarchy. */}
    <View style={{ paddingHorizontal: 20, marginTop: -26 }}>
      <View style={{ padding: 8, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: '#39070D', shadowOpacity: 0.11, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 2 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: phase === 'idle' ? '#2E9D69' : '#C4202F', marginRight: 8 }} />
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 }}>{phase === 'idle' ? 'ABSENSI HARI INI' : t(phase === 'saving' ? 'verifying' : 'preparing').toUpperCase()}</Text>
        </View>
        <AttendanceSummaryCard now={now} onAttend={() => pending.current ? void begin() : blockUnlessApproved() ? undefined : setConsentVisible(true)} disabled={phase !== 'idle' || !!error} />
      </View>
    </View>

    <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ width: 4, height: 21, borderRadius: 3, backgroundColor: '#C4202F', marginRight: 9 }} />
        <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>Verifikasi sebelum absen</Text>
      </View>
      {!faceApproved ? <View style={{ marginBottom: 14 }}><FaceStatusCard onOpen={() => navigation.navigate('FaceEnrollment', { returnTo: 'Attendance' })} /></View> : null}
      {data?.office ? <View style={{ marginBottom: 14 }}><GeofenceCard office={data.office} now={now} disabled={phase !== 'idle'} serverError={!!error} /></View> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 15, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: '#FCE8EA', alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#8B0D1A" />
        </View>
        <Text style={{ flex: 1, color: colors.muted, lineHeight: 21, fontSize: 13 }}>{t('attendanceHint')}</Text>
      </View>
    </View>
    {outsideCheckInPending ? <View style={{ marginHorizontal: 20, marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: colors.warningSoft, borderLeftWidth: 4, borderLeftColor: colors.warning }}><Text accessibilityRole="alert" style={{ color: colors.warning, lineHeight: 21, fontWeight: '600' }}>{t('outsideCheckInReminder')}</Text></View> : null}
    {phase !== 'idle' ? <View style={{ marginHorizontal: 20, marginTop: 16, padding: 18, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }}><ActivityIndicator color="#C4202F" /><Text style={{ color: colors.muted, marginLeft: 12, fontWeight: '700', flex: 1 }}>{t(phase === 'saving' ? 'verifying' : 'preparing')}</Text></View> : null}
    {message ? <View style={{ marginHorizontal: 20, marginTop: 14 }}><StatusNotice tone={messageTone}>{message}</StatusNotice></View> : null}
    {retryAvailable ? <Pressable accessibilityRole="button" onPress={begin} style={[button, { marginHorizontal: 20 }]}><Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{t('retrySubmission')}</Text></Pressable> : null}
    {permissionDenied ? <Pressable accessibilityRole="button" style={[button, { marginHorizontal: 20 }]} onPress={() => void Linking.openSettings().catch(() => setMessage(t('settingsError')))}><Text style={{ color: '#FFFFFF' }}>{t('openSettings')}</Text></Pressable> : null}
    <View style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', marginTop: 30, marginBottom: 15 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}>{t('recentAttendance')}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Riwayat kehadiran terbaru</Text>
      </View>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#FCE8EA', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="time-outline" size={20} color="#8B0D1A" /></View>
    </View>
    {!data?.attendance.length ? (
      <View style={{ marginHorizontal: 20, padding: 24, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
        <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: '#FCE8EA', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Ionicons name="calendar-clear-outline" size={24} color="#8B0D1A" />
        </View>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>{t('noAttendance')}</Text>
      </View>
    ) : data.attendance
      .filter((r) => now.getTime() - new Date(r.recorded_at).getTime() <= 30 * 86400000)
      .map((r) => (
        <View key={r.id} style={{ marginHorizontal: 20, flexDirection: 'row', marginBottom: 12 }}>
          <View style={{ width: 34, alignItems: 'center', marginRight: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: ['matched', 'verified'].includes(r.face_status ?? '') ? '#E4F6EC' : '#FCE8EA', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={r.type === 'check-in' ? 'log-in-outline' : 'log-out-outline'} size={18} color={['matched', 'verified'].includes(r.face_status ?? '') ? '#248451' : '#8B0D1A'} />
            </View>
            <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: colors.border, marginTop: 5 }} />
          </View>
          <View style={{ flex: 1, padding: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: '#39070D', shadowOpacity: 0.045, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 14, flex: 1 }}>{t(r.type === 'check-in' ? 'checkInLabel' : 'checkOutLabel')}</Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: ['matched', 'verified'].includes(r.face_status ?? '') ? '#E4F6EC' : '#FCE8EA' }}>
                <Text style={{ color: ['matched', 'verified'].includes(r.face_status ?? '') ? '#248451' : '#8B0D1A', fontSize: 10, fontWeight: '800' }}>
                  {['matched', 'verified'].includes(r.face_status ?? '') ? 'TERVERIFIKASI' : 'DIPROSES'}
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.muted, marginTop: 7, fontSize: 12 }}>{new Date(r.recorded_at).toLocaleString(language === 'en' ? 'en-GB' : 'id-ID', { timeZone: data.office.time_zone })}</Text>
            <Text style={{ color: ['matched', 'verified'].includes(r.face_status ?? '') ? colors.success : colors.muted, marginTop: 8, fontSize: 12, fontWeight: '600' }}>{t(attendanceVerificationLabel(r))}</Text>
            {r.location_status === 'outside_office' ? (
              <>
                <Text selectable style={{ color: r.review_status === 'approved' ? colors.success : r.review_status === 'rejected' ? colors.danger : colors.warning, lineHeight: 20, marginTop: 6 }}>
                  {t('outsideOffice')}: {r.latitude?.toFixed(6)}, {r.longitude?.toFixed(6)}
                  {r.review_status === 'approved' ? `\n${t('outsideApproved')}` : r.review_status === 'rejected' ? `\n${t('outsideRejected')}` : `\n${t('outsidePending')}`}
                  {r.review_note ? `\nHR: ${r.review_note}` : ''}
                  {r.employee_note ? `\n${t('employeeClarification')}: ${r.employee_note}` : ''}
                </Text>
                {r.review_status === 'clarification_requested' && !r.employee_note ? (
                  <View style={{ marginTop: 10 }}>
                    <TextInput accessibilityLabel={t('clarificationInput')} editable={!sendingClarification} value={clarification?.id === r.id ? clarification.value : ''} onChangeText={(value) => setClarification({ id: r.id, value })} placeholder={t('clarificationInput')} placeholderTextColor={colors.muted} multiline maxLength={2000} style={{ minHeight: 76, borderWidth: 1, borderColor: colors.border, borderRadius: 14, color: colors.ink, padding: 12, textAlignVertical: 'top', backgroundColor: colors.background }} />
                    <Pressable accessibilityRole="button" disabled={sendingClarification || clarification?.id !== r.id || !clarification.value.trim()} onPress={() => void sendClarification()} style={[button, { opacity: sendingClarification || clarification?.id !== r.id || !clarification.value.trim() ? 0.5 : 1 }]}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{t('sendClarification')}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      ))}
    <Modal visible={outsidePrompt !== null} transparent animationType="fade" onRequestClose={() => decideOutside(false)}>
      <View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 24 }}><View accessibilityViewIsModal style={{ backgroundColor: colors.surface, padding: 24, borderRadius: 26, borderWidth: 1, borderColor: colors.border, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={{ color: colors.warning, fontSize: 22, fontWeight: '800' }}>{t('outsideOfficeTitle')}</Text>
        <Text style={{ color: colors.ink, lineHeight: 23, marginTop: 14 }}>{t('outsideOfficeWarning')}</Text>
        <Text selectable style={{ color: colors.muted, lineHeight: 21, marginTop: 12 }}>{t('currentLocation')}: {outsidePrompt?.sample.latitude.toFixed(6)}, {outsidePrompt?.sample.longitude.toFixed(6)}{'\n'}{t('officeDistance')}: {Math.round(outsidePrompt?.distance ?? 0)} m</Text>
        <Pressable accessibilityRole="button" onPress={() => decideOutside(true)} style={button}><Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{t('outsideOfficeYes')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => decideOutside(false)} style={[button, { backgroundColor: colors.primarySoft }]}><Text style={{ color: colors.ink, fontWeight: '800' }}>{t('outsideOfficeNo')}</Text></Pressable>
      </View></View>
    </Modal>
    <Modal visible={consentVisible} transparent animationType="fade" onRequestClose={() => setConsentVisible(false)}>
      <View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 24 }}><ScrollView contentContainerStyle={{ backgroundColor: colors.surface, padding: 24, borderRadius: 26, borderWidth: 1, borderColor: colors.border, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 22, fontWeight: '800' }}>{t('faceConsentTitle')}</Text>
        <Text style={{ color: colors.ink, marginTop: 16, lineHeight: 23 }}>{t('faceConsentBody')}</Text>
        <Pressable accessibilityRole="button" onPress={() => { setConsentVisible(false); void begin(); }} style={button}><Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{t('faceConsentAccept')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setConsentVisible(false); setMessageTone('warning'); setMessage(t('faceException')); }} style={[button, { backgroundColor: colors.primarySoft }]}><Text style={{ color: colors.ink }}>{t('faceExceptionButton')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setConsentVisible(false)} style={[button, { backgroundColor: colors.primarySoft }]}><Text style={{ color: colors.ink }}>{t('cancel')}</Text></Pressable>
      </ScrollView></View>
    </Modal>
    <Modal visible={visible} animationType="slide" onRequestClose={cancel}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {auto ? <>
          <View style={{ flex: 1 }}>
            <FaceLivenessCameraLoader key={`${captureStep}-${steps[captureStep]}`} pose={steps[captureStep] === 'left' ? 'left' : steps[captureStep] === 'right' ? 'right' : 'front'}
              active={visible && phase === 'camera'} onCaptured={(photo) => void runCapture(async () => photo)} onError={onAutoError} />
          </View>
          <View style={{ backgroundColor: '#2A0A10', ...gradient('linear-gradient(155deg, #2A0A10 0%, #5C0711 100%)'), padding: 20, paddingBottom: Math.max(insets.bottom, 20) }}>
            <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18, textAlign: 'center' }}>{captureStep + 1}/{steps.length} · {t(`faceStep${facePoses.indexOf(steps[captureStep])}`)}</Text>
            <View accessible={false} style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 }}>{steps.map((pose, index) => <View key={pose} style={{ width: 28, height: 6, borderRadius: 3, backgroundColor: index < captureStep ? '#4ADE80' : index === captureStep ? '#FFFFFF' : '#5A5A60' }} />)}</View>
            <Text accessibilityLiveRegion="polite" style={{ color: '#E5E5EA', textAlign: 'center', marginTop: 12, lineHeight: 20 }}>{t('faceAutoHint')}</Text>
            <Pressable accessibilityRole="button" onPress={() => { cancel(); setMessageTone('warning'); setMessage(t('faceException')); }} style={[button, { backgroundColor: '#5C0711' }]}><Text style={{ color: '#FFFFFF' }}>{t('faceExceptionButton')}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={phase === 'saving'} onPress={cancel} style={[button, { backgroundColor: '#5C0711' }]}><Text style={{ color: '#FFFFFF' }}>{t('cancel')}</Text></Pressable>
          </View>
        </> : <>
        <CameraView ref={camera} facing="front" mode="picture" pictureSize={pictureSize} onCameraReady={() => void cameraReady()} onMountError={(e) => { setMessageTone('danger'); setMessage(e.message); cancel(); }} style={{ flex: 1 }} />
        <View pointerEvents="none" style={{ position: 'absolute', top: '12%', left: '20%', width: '60%', height: '40%', borderRadius: 150, borderWidth: 3, borderColor: '#FFFFFF' }} />
        <ScrollView style={{ maxHeight: '48%', backgroundColor: '#2A0A10', ...gradient('linear-gradient(155deg, #2A0A10 0%, #5C0711 100%)') }} contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20) }}><Text accessibilityRole="header" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 20, textAlign: 'center' }}>{captureStep + 1}/5 · {t(`faceStep${captureStep}`)}</Text><Text accessibilityLiveRegion="polite" style={{ color: '#FFFFFF', textAlign: 'center', marginVertical: 12 }}>{t(`faceGuide${captureStep}`)}</Text><Text style={{ color: '#FFE6E7', textAlign: 'center', lineHeight: 20 }}>{t(policy ? 'facePolicyMulti' : 'facePolicyLegacy')}</Text>
          {captureStep === 1 && !policy?.require_without_glasses ? <Pressable accessibilityRole="button" disabled={phase !== 'camera'} onPress={() => setCaptureStep(2)} style={button}><Text style={{ color: '#FFFFFF' }}>{t('noGlasses')}</Text></Pressable> : null}
          <Pressable accessibilityRole="button" onPress={() => { cancel(); setMessageTone('warning'); setMessage(t('faceException')); }} style={[button, { backgroundColor: '#5C0711' }]}><Text style={{ color: '#FFFFFF' }}>{t('faceExceptionButton')}</Text></Pressable>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Pressable accessibilityRole="button" disabled={phase === 'saving'} onPress={cancel} style={[button, { flex: 1, backgroundColor: '#5C0711' }]}><Text style={{ color: '#FFFFFF' }}>{t('cancel')}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={!ready || phase !== 'camera'} onPress={capture} style={[button, { flex: 2, opacity: ready && phase === 'camera' ? 1 : 0.5 }]}>{phase === 'capturing' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{t('captureContinue')}</Text>}</Pressable>
        </View></ScrollView>
        </>}
      </View>
    </Modal>
  </ScrollView>;
}
