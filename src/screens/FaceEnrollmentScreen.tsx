import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RouteProp, useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FaceLivenessCamera from '../components/FaceLivenessCameraLoader';
import type { CapturedFacePhoto } from '../components/faceLivenessCameraTypes';
import ScreenHeader from '../components/ScreenHeader';
import StatusNotice, { NoticeTone } from '../components/StatusNotice';
import { useFaceStatus } from '../context/FaceStatusContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import type { EmployeeTabParamList } from '../navigation/AppNavigator';
import { api, ApiError, AttendanceChallenge, createRequestId, FaceCapture } from '../services/api';
import { EnrollmentPose, enrollmentPoses, failedPosesFromErrors, makeFaceCapture, requireCaptures } from '../services/faceCapture';

type Step = 'idle' | 'preparing' | 'capturing' | 'review' | 'submitting';
const poseLabel: Record<EnrollmentPose, string> = { front: 'fePoseFront', left: 'feTurnLeft', right: 'feTurnRight' };

export default function FaceEnrollmentScreen() {
  const { t, language } = useLanguage(); const { colors } = useTheme(); const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<EmployeeTabParamList>>();
  const route = useRoute<RouteProp<EmployeeTabParamList, 'FaceEnrollment'>>();
  const focused = useIsFocused();
  const { info, faceStatus, error: statusError, loading, refresh, markPending } = useFaceStatus();

  const [step, setStep] = useState<Step>('idle');
  const [consent, setConsent] = useState(false);
  const [queue, setQueue] = useState<EnrollmentPose[]>([]);
  const [captures, setCaptures] = useState<FaceCapture[]>([]);
  const [failed, setFailed] = useState<EnrollmentPose[]>([]);
  const [message, setMessage] = useState<{ text: string; tone: NoticeTone } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  // Photos live ONLY in memory (this ref + state). They are never written to storage; see wipe().
  const capturesRef = useRef<FaceCapture[]>([]); const challenge = useRef<AttendanceChallenge | null>(null);
  const submitKey = useRef<string | null>(null); const lock = useRef(false); const operation = useRef(0); const stepRef = useRef<Step>('idle');
  stepRef.current = step;

  const setAllCaptures = (next: FaceCapture[]) => { capturesRef.current = next; submitKey.current = null; setCaptures(next); };
  const wipe = useCallback(() => {
    operation.current++; capturesRef.current = []; challenge.current = null; submitKey.current = null; lock.current = false;
    setCaptures([]); setQueue([]); setFailed([]); setStep('idle');
  }, []);
  const close = useCallback(() => { wipe(); navigation.navigate(route.params?.returnTo ?? 'Profile'); }, [navigation, route.params?.returnTo, wipe]);

  // Leaving the screen discards every captured photo.
  useFocusEffect(useCallback(() => () => { wipe(); setConsent(false); setMessage(null); }, [wipe]));
  // Opening the screen (also via push) always shows the latest server status.
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
      if (state === 'background' && ['capturing', 'review', 'preparing'].includes(stepRef.current)) { wipe(); setMessage({ text: t('feBackgroundReset'), tone: 'warning' }); }
    });
    return () => sub.remove();
  }, [t, wipe]);

  async function newChallenge() {
    const next = await api.getAttendanceChallenge();
    challenge.current = next; submitKey.current = null; return next;
  }
  async function start() {
    if (lock.current || !consent) return;
    lock.current = true; const version = ++operation.current; setStep('preparing'); setMessage(null);
    try {
      await newChallenge();
      if (version !== operation.current) return;
      setAllCaptures([]); setFailed([]); setQueue([...enrollmentPoses]); setStep('capturing');
    } catch (e) {
      if (version !== operation.current) return;
      setStep('idle'); setMessage({ text: e instanceof Error ? e.message : t('saveError'), tone: 'danger' });
    } finally { if (version === operation.current) lock.current = false; }
  }
  function onCaptured(photo: CapturedFacePhoto) {
    const pose = queue[0]; if (!pose) return;
    try {
      const capture = makeFaceCapture(pose, photo.base64, photo.capturedAt);
      setAllCaptures([...capturesRef.current.filter((c) => c.pose !== pose), capture].sort((a, b) => enrollmentPoses.indexOf(a.pose as EnrollmentPose) - enrollmentPoses.indexOf(b.pose as EnrollmentPose)));
      setFailed((current) => current.filter((p) => p !== pose));
      const rest = queue.slice(1); setQueue(rest);
      if (rest.length === 0) setStep('review');
    } catch (e) { setMessage({ text: e instanceof Error ? e.message : t('saveError'), tone: 'danger' }); setQueue([...queue]); setAttempt((n) => n + 1); }
  }
  function retake(pose: EnrollmentPose) { setMessage(null); setQueue([pose]); setStep('capturing'); }
  async function submit() {
    if (lock.current || step !== 'review') return;
    lock.current = true; const version = operation.current; setStep('submitting'); setMessage(null);
    try {
      const photos = requireCaptures(capturesRef.current);
      const current = challenge.current;
      if (!current || Date.parse(current.expires_at) <= Date.now()) {
        // Challenge lapsed while the user reviewed/retook photos: get a fresh one, keep the photos, let the user send again.
        await newChallenge();
        if (version !== operation.current) return;
        setStep('review'); setMessage({ text: t('feChallengeExpired'), tone: 'warning' }); return;
      }
      submitKey.current ??= createRequestId();
      await api.enrollFace({ challenge_id: current.id, consent_version: '1', captures: photos }, submitKey.current);
      if (version !== operation.current) return;
      wipe(); setConsent(false); markPending(); setMessage({ text: t('feSubmitted'), tone: 'success' }); void refresh();
    } catch (e) {
      if (version !== operation.current) return;
      setStep('review');
      if (e instanceof ApiError && e.status === 422) {
        // Show the server's own message and let the user retake only the poses it flagged.
        setFailed(failedPosesFromErrors(e.errors, capturesRef.current)); submitKey.current = null;
        setMessage({ text: e.message, tone: 'danger' });
      } else if (e instanceof ApiError && e.status && e.status < 500 && e.status !== 429) {
        wipe(); setMessage({ text: e.message, tone: 'danger' }); void refresh();
      } else setMessage({ text: e instanceof Error ? e.message : t('saveError'), tone: 'danger' });
    } finally { if (version === operation.current) lock.current = false; }
  }

  const button = { minHeight: 50, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary, marginTop: 14, paddingHorizontal: 16 };
  const soft = { ...button, backgroundColor: colors.primarySoft };
  const whenText = info?.updated_at && !Number.isNaN(Date.parse(info.updated_at)) ? new Date(info.updated_at).toLocaleString(language === 'en' ? 'en-GB' : 'id-ID') : null;
  const showStatusView = step === 'idle' && (faceStatus === 'pending' || faceStatus === 'approved');
  const currentPose = queue[0]; const poseIndex = currentPose ? enrollmentPoses.indexOf(currentPose) + 1 : 0;

  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingTop: insets.top + 12, paddingBottom: 40, flexGrow: 1 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('feBack')} onPress={close} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}><Ionicons name="chevron-back" size={22} color={colors.ink} /><Text style={{ color: colors.ink, fontWeight: '700' }}>{t('feBack')}</Text></Pressable>
    <ScreenHeader eyebrow={t('feEyebrow')} title={t('feTitle')} subtitle={t('feSubtitle')} />
    {message ? <StatusNotice tone={message.tone}>{message.text}</StatusNotice> : null}

    {showStatusView ? <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
      <Ionicons name={faceStatus === 'approved' ? 'checkmark-circle' : 'time-outline'} size={56} color={faceStatus === 'approved' ? colors.success : colors.warning} />
      <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 12, textAlign: 'center' }}>{t(faceStatus === 'approved' ? 'feApprovedTitle' : 'fePendingTitle')}</Text>
      <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 21, textAlign: 'center' }}>{t(faceStatus === 'approved' ? 'feApprovedBody' : 'fePendingBody')}</Text>
      {whenText ? <Text style={{ color: colors.muted, marginTop: 8, fontSize: 12 }}>{whenText}</Text> : null}
      <Pressable accessibilityRole="button" disabled={loading} onPress={() => void refresh()} style={[soft, { alignSelf: 'stretch', opacity: loading ? 0.5 : 1 }]}>{loading ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accent, fontWeight: '800' }}>{t('feViewStatus')}</Text>}</Pressable>
    </View> : null}

    {!showStatusView && (step === 'idle' || step === 'preparing') ? <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: colors.border }}>
      {faceStatus === 'rejected' ? <StatusNotice tone="danger">{`${t('feRejectedReason')}: ${info?.rejection_reason || '—'}`}</StatusNotice> : null}
      {!faceStatus && statusError ? <StatusNotice tone="warning">{t('feStatusError')}</StatusNotice> : null}
      <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>{t('feConsentTitle')}</Text>
      <Text style={{ color: colors.ink, marginTop: 10, lineHeight: 22 }}>{t('feConsentBody')}</Text>
      <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 12, marginTop: 18 }}>{t('feGuideTitle')}</Text>
      {(['feGuideGlasses', 'feGuideLight', 'feGuideOne'] as const).map((key) => <View key={key} style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}><Ionicons name="checkmark-circle-outline" size={18} color={colors.accent} /><Text style={{ color: colors.ink, flex: 1, lineHeight: 20 }}>{t(key)}</Text></View>)}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent((v) => !v)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 20, minHeight: 44 }}>
        <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={26} color={consent ? colors.accent : colors.muted} /><Text style={{ color: colors.ink, flex: 1, lineHeight: 21 }}>{t('feConsentCheck')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !consent || step !== 'idle' }} disabled={!consent || step !== 'idle'} onPress={() => void start()} style={[button, { opacity: consent && step === 'idle' ? 1 : 0.5 }]}>{step === 'preparing' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{t('feStart')}</Text>}</Pressable>
    </View> : null}

    {step === 'review' || step === 'submitting' ? <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: colors.border }}>
      <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>{t('feReviewTitle')}</Text>
      <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>{t('feReviewHint')}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        {enrollmentPoses.map((pose) => { const c = captures.find((x) => x.pose === pose); const bad = failed.includes(pose);
          return <View key={pose} style={{ flex: 1 }}>
            <View style={{ aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: bad ? colors.danger : colors.border, backgroundColor: colors.primarySoft }}>
              {c ? <Image accessibilityLabel={t(poseLabel[pose])} source={{ uri: `data:image/jpeg;base64,${c.photo_base64}` }} style={{ flex: 1 }} resizeMode="cover" /> : null}
            </View>
            <Text style={{ color: bad ? colors.danger : colors.ink, fontWeight: '700', fontSize: 12, textAlign: 'center', marginTop: 6 }}>{t(poseLabel[pose])}</Text>
            {bad ? <Text style={{ color: colors.danger, fontSize: 11, textAlign: 'center' }}>{t('feNeedRetake')}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`${t('feRetakePose')} ${t(poseLabel[pose])}`} disabled={step === 'submitting'} onPress={() => retake(pose)} style={[soft, { minHeight: 40, marginTop: 6, opacity: step === 'submitting' ? 0.5 : 1 }]}><Text style={{ color: colors.accent, fontWeight: '800' }}>{t('feRetakePose')}</Text></Pressable>
          </View>; })}
      </View>
      <Pressable accessibilityRole="button" disabled={step === 'submitting'} onPress={() => void submit()} style={[button, { opacity: step === 'submitting' ? 0.6 : 1 }]}>{step === 'submitting' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{t('feSubmit')}</Text>}</Pressable>
      <Pressable accessibilityRole="button" disabled={step === 'submitting'} onPress={wipe} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.muted }}>{t('feCancel')}</Text></Pressable>
    </View> : null}

    <Modal visible={step === 'capturing'} animationType="slide" onRequestClose={wipe}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#222225' }}>
          <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18, textAlign: 'center' }}>{currentPose ? `${t('fePoseProgress')} ${poseIndex}/3 · ${t(poseLabel[currentPose])}` : ''}</Text>
          <Text style={{ color: '#E5E5E7', textAlign: 'center', marginTop: 6, fontSize: 12, lineHeight: 17 }}>{`${t('feGuideGlasses')} ${t('feGuideLight')} ${t('feGuideOne')}`}</Text>
          {message ? <Text accessibilityRole="alert" style={{ color: '#FFB4B4', textAlign: 'center', marginTop: 8, fontSize: 12 }}>{message.text}</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          {currentPose ? <FaceLivenessCamera key={`${currentPose}-${attempt}`} pose={currentPose} active={step === 'capturing' && focused && appActive} onCaptured={onCaptured}
            onError={(text, kind) => { setMessage({ text, tone: 'danger' }); if (kind === 'permission' || kind === 'camera') wipe(); }} /> : null}
        </View>
        <Pressable accessibilityRole="button" onPress={wipe} style={{ minHeight: 52, margin: 16, marginBottom: Math.max(insets.bottom, 16), borderRadius: 14, backgroundColor: '#414146', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{t('feCancel')}</Text></Pressable>
      </View>
    </Modal>
  </ScrollView>;
}
