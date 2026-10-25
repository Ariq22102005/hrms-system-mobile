import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StatusNotice, { NoticeTone } from '../components/StatusNotice';
import Toolbar from '../components/Toolbar';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { dateKey } from '../services/attendanceSummary';
import { api, createRequestId } from '../services/api';

const PAD = 20;
// Dictionary labels are written in capitals; show them in sentence case.
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

// --- date helpers (all calendar math is done on YYYY-MM-DD keys in UTC, so time zones never shift a day) ---
const toDate = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (key: string, n: number) => { const d = toDate(key); d.setUTCDate(d.getUTCDate() + n); return toKey(d); };
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000) + 1;
type Tone = 'approved' | 'pending' | 'rejected';
const strength: Record<Tone, number> = { approved: 3, pending: 2, rejected: 1 };

type CalendarProps = {
  start: string; end: string; month: { y: number; m: number }; today: string; locale: string;
  marks: Map<string, Tone>; onMonth: (delta: number) => void; onPick: (key: string) => void;
  labels: { prev: string; next: string; selected: string; approved: string; pending: string; rejected: string };
};
function LeaveCalendar({ start, end, month, today, locale, marks, onMonth, onPick, labels }: CalendarProps) {
  const { colors } = useTheme();
  const first = new Date(Date.UTC(month.y, month.m, 1));
  const offset = (first.getUTCDay() + 6) % 7; // weeks start on Monday
  const total = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => toKey(new Date(Date.UTC(month.y, month.m, i + 1))))];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const toneColor = { approved: colors.success, pending: colors.warning, rejected: colors.danger } as const;
  const nav = { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } as const;
  return <View>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={labels.prev} onPress={() => onMonth(-1)} style={nav}><Ionicons name="chevron-back" size={20} color={colors.ink} /></Pressable>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>{first.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={labels.next} onPress={() => onMonth(1)} style={nav}><Ionicons name="chevron-forward" size={20} color={colors.ink} /></Pressable>
    </View>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', marginBottom: 4 }}>
      {Array.from({ length: 7 }, (_, i) => <Text key={i} style={{ width: `${100 / 7}%`, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '700' }}>{new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })}</Text>)}
    </View>
    {weeks.map((week, w) => <View key={w} style={{ flexDirection: 'row' }}>
      {week.map((key, c) => {
        if (!key) return <View key={c} style={{ width: `${100 / 7}%`, height: 50 }} />;
        const isStart = key === start; const isEnd = key === end; const edge = isStart || isEnd; const inRange = key >= start && key <= end;
        const mark = marks.get(key); const isToday = key === today; const day = Number(key.slice(8));
        const label = `${toDate(key).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}${inRange ? `, ${labels.selected}` : ''}${mark ? `, ${labels[mark]}` : ''}`;
        return <Pressable key={c} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: inRange }} onPress={() => onPick(key)} style={{ width: `${100 / 7}%`, height: 50, alignItems: 'center' }}>
          <View style={{ width: '100%', height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: inRange && start !== end ? colors.primarySoft : 'transparent', borderTopLeftRadius: isStart && start !== end ? 20 : 0, borderBottomLeftRadius: isStart && start !== end ? 20 : 0, borderTopRightRadius: isEnd && start !== end ? 20 : 0, borderBottomRightRadius: isEnd && start !== end ? 20 : 0 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: edge ? colors.primary : 'transparent', borderWidth: isToday && !edge ? 1.5 : 0, borderColor: colors.accent }}>
              <Text style={{ color: edge ? colors.onPrimary : colors.ink, fontSize: 14, fontWeight: edge || isToday ? '800' : '500' }}>{day}</Text>
            </View>
          </View>
          {mark ? <View style={{ position: 'absolute', bottom: 1, width: 6, height: 6, borderRadius: 3, backgroundColor: toneColor[mark] }} /> : null}
        </Pressable>;
      })}
    </View>)}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
      {(['pending', 'approved', 'rejected'] as const).map((tone) => <View key={tone} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: toneColor[tone] }} /><Text style={{ color: colors.muted, fontSize: 12 }}>{labels[tone]}</Text></View>)}
    </View>
  </View>;
}

export default function LeaveScreen() {
  const { employee } = useAuth();
  const { data, refresh, error: loadError } = useData();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-GB' : 'id-ID';
  const leaveTypes = ['annual', 'sick', 'important'];
  const leaveLabels: Record<string, string> = { annual: t('annualLeave'), sick: t('sickLeave'), important: t('importantLeave') };
  const [leaveType, setLeaveType] = useState('');
  const [startDate, setStartDate] = useState(() => dateKey(new Date()));
  const [endDate, setEndDate] = useState(() => dateKey(new Date()));
  const [reason, setReason] = useState('');
  const requests = (data?.leaves ?? []).map((r) => ({ id: r.id, leaveType: r.leave_type, startDate: r.start_date, endDate: r.end_date, reason: r.reason, status: r.status }));
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<NoticeTone>('warning');
  const isLoading = !data && !loadError;
  const [viewMonth, setViewMonth] = useState(() => ({ y: Number(startDate.slice(0, 4)), m: Number(startDate.slice(5, 7)) - 1 }));
  const [pickingEnd, setPickingEnd] = useState(false);
  const today = dateKey(new Date(), data?.office.time_zone);
  const L = language === 'en'
    ? { help: 'Tap a start date, then an end date. Dots show your existing requests.', days: (n: number) => (n === 1 ? '1 day' : `${n} days`), overlap: 'These dates already have a pending or approved request.', prev: 'Previous month', next: 'Next month', selected: 'selected', from: 'From', to: 'To', duration: 'Duration' }
    : { help: 'Ketuk tanggal mulai, lalu tanggal selesai. Titik menandai pengajuan Anda.', days: (n: number) => `${n} hari`, overlap: 'Tanggal ini sudah punya pengajuan menunggu atau disetujui.', prev: 'Bulan sebelumnya', next: 'Bulan berikutnya', selected: 'dipilih', from: 'Dari', to: 'Sampai', duration: 'Durasi' };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lock = useRef(false);
  const requestId = useRef<{ key: string; fingerprint: string } | null>(null);
  const selectedLeaveType = leaveType || leaveTypes[0];
  const approved = requests.filter((r) => r.status === 'approved').length;
  const rejected = requests.filter((r) => r.status === 'rejected').length;
  const pending = requests.length - approved - rejected;

  // Every day covered by an existing request, tagged with its strongest status (approved > pending > rejected).
  const marks = new Map<string, Tone>();
  for (const r of requests) {
    if (!isValidDate(r.startDate) || !isValidDate(r.endDate) || r.startDate > r.endDate) continue;
    const tone: Tone = r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending';
    for (let key = r.startDate, i = 0; key <= r.endDate && i < 366; key = addDays(key, 1), i++) {
      const old = marks.get(key); if (!old || strength[tone] > strength[old]) marks.set(key, tone);
    }
  }
  const rangeValid = isValidDate(startDate) && isValidDate(endDate) && startDate <= endDate;
  const overlaps = rangeValid && requests.some((r) => r.status !== 'rejected' && r.startDate <= endDate && r.endDate >= startDate);
  function pick(key: string) {
    if (!pickingEnd) { setStartDate(key); setEndDate(key); setPickingEnd(true); return; }
    if (key < startDate) setStartDate(key); else setEndDate(key);
    setPickingEnd(false);
  }
  function moveMonth(delta: number) { setViewMonth(({ y, m }) => { const d = new Date(Date.UTC(y, m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; }); }

  function asIsoDate(value: string) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value.trim();
  }

  function isValidDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
  }

  async function submitRequest() {
    if (lock.current) return;
    setMessageTone('warning');
    if (!employee || !startDate || !endDate || !reason.trim()) {
      setMessage(t('leaveRequired'));
      return;
    }
    const normalizedStart = asIsoDate(startDate);
    const normalizedEnd = asIsoDate(endDate);
    if (!isValidDate(normalizedStart) || !isValidDate(normalizedEnd)) {
      setMessage(t('dateInvalid'));
      return;
    }
    if (normalizedStart > normalizedEnd) {
      setMessage(t('dateOrder'));
      return;
    }

    lock.current = true;
    setIsSubmitting(true);
    const payload = { leave_type: selectedLeaveType, start_date: normalizedStart, end_date: normalizedEnd, reason: reason.trim() };
    try {
      const fingerprint = JSON.stringify(payload);
      const existing = requestId.current;
      const key = existing?.fingerprint === fingerprint ? existing.key : createRequestId();
      requestId.current = { key, fingerprint };
      await api.postLeaveRequest(payload, key);
      requestId.current = null;
      setReason('');
      setMessageTone('success'); setMessage(t('leaveSaved'));
      await refresh(true);
    } catch (submitError) {
      setMessageTone('danger'); setMessage(submitError instanceof Error ? submitError.message : t('saveError'));
    } finally {
      lock.current = false;
      setIsSubmitting(false);
    }
  }

  const card = { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border } as const;
  const tile = { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' } as const;
  const label = { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 8 } as const;
  const input = { borderWidth: 1, borderColor: colors.border, borderRadius: 14, color: colors.ink, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, minHeight: 50 } as const;
  const statusIcon = (status: string) => (status === 'approved' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'time-outline');
  const summary = [
    ['time-outline', t('pending'), pending, colors.warning],
    ['checkmark-circle-outline', t('approved'), approved, colors.success],
    ['close-circle-outline', t('rejected'), rejected, colors.danger],
  ] as const;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 40, flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
      {/* Header: controls, page title and what this page is for */}
      <View style={{ backgroundColor: colors.primary, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingHorizontal: PAD, paddingTop: insets.top + 12, paddingBottom: 64, overflow: 'hidden' }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', right: -14, bottom: -20, opacity: 0.12 }}><Ionicons name="calendar" size={160} color={colors.onPrimary} /></View>
        <Toolbar hideProfile onPrimary />
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={{ color: colors.onPrimary, fontSize: 30, fontWeight: '800', marginTop: 8 }}>{t('leaveTitle')}</Text>
        <Text style={{ color: colors.onPrimary, fontSize: 14, lineHeight: 21, marginTop: 6, maxWidth: 420 }}>{t('leaveSubtitle')}</Text>
      </View>

      <View style={{ paddingHorizontal: PAD }}>
        {/* Overview card overlapping the header */}
        <View style={{ ...card, marginTop: -40, flexDirection: 'row', paddingVertical: 16, marginBottom: 24 }}>
          {summary.map(([icon, text, count, tone], index) => <View key={text} accessible accessibilityLabel={`${text}: ${data ? count : '-'}`} style={{ flex: 1, alignItems: 'center', borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: colors.border }}>
            <Ionicons name={icon} size={20} color={tone} />
            <Text maxFontSizeMultiplier={1.3} style={{ color: colors.ink, fontSize: 26, fontWeight: '800', marginTop: 4 }}>{data ? count : '—'}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{text}</Text>
          </View>)}
        </View>

        {/* New request */}
        <View style={{ ...card, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={tile}><Ionicons name="create-outline" size={24} color={colors.accent} /></View>
            <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontWeight: '800', flex: 1 }}>{t('newLeave')}</Text>
          </View>

          <Text style={label}>{sentence(t('leaveType'))}</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {leaveTypes.map((type) => {
              const selected = selectedLeaveType === type;
              return <Pressable key={type} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={leaveLabels[type]} onPress={() => setLeaveType(type)} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.8 : 1 })}>
                {selected ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
                <Text style={{ color: selected ? colors.onPrimary : colors.ink, fontWeight: '700', fontSize: 14 }}>{leaveLabels[type]}</Text>
              </Pressable>;
            })}
          </View>

          <Text style={{ ...label, marginBottom: 4 }}>{sentence(t('start'))} – {sentence(t('end')).toLowerCase()}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>{L.help}</Text>
          <View style={{ backgroundColor: colors.background, borderRadius: 18, padding: 12 }}>
            <LeaveCalendar start={startDate} end={endDate} month={viewMonth} today={today} locale={locale} marks={marks} onMonth={moveMonth} onPick={pick} labels={{ prev: L.prev, next: L.next, selected: L.selected, approved: t('approved'), pending: t('pending'), rejected: t('rejected') }} />
          </View>
          <View accessible accessibilityLabel={`${L.from} ${startDate}, ${L.to} ${endDate}, ${rangeValid ? L.days(daysBetween(startDate, endDate)) : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
            {([[L.from, startDate], [L.to, endDate]] as const).map(([cap, value]) => <View key={cap} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{cap}</Text>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 2 }}>{isValidDate(value) ? toDate(value).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : value}</Text>
            </View>)}
            <View style={{ backgroundColor: colors.primarySoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{L.duration}</Text>
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '800', marginTop: 2 }}>{rangeValid ? L.days(daysBetween(startDate, endDate)) : '—'}</Text>
            </View>
          </View>
          {overlaps ? <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12 }}><Ionicons name="alert-circle-outline" size={18} color={colors.warning} /><Text style={{ flex: 1, color: colors.warning, fontSize: 13, lineHeight: 19 }}>{L.overlap}</Text></View> : null}

          <Text style={label}>{sentence(t('reason'))}</Text>
          <TextInput accessibilityLabel={t('reason')} multiline numberOfLines={3} value={reason} onChangeText={setReason} placeholder={t('reasonPlaceholder')} placeholderTextColor={colors.muted} style={{ ...input, minHeight: 96, textAlignVertical: 'top' }} />

          <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={submitRequest} style={({ pressed }) => ({ minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary, marginTop: 24, opacity: isSubmitting ? 0.6 : pressed ? 0.85 : 1 })}>
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{t('submitLeave')}</Text>}
          </Pressable>
          {message ? <StatusNotice tone={messageTone}>{message}</StatusNotice> : null}
        </View>

        {/* History */}
        <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 28, marginBottom: 12 }}>{sentence(t('leaveHistory'))}</Text>
        {loadError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13, lineHeight: 19, marginBottom: 8 }}>{loadError}</Text> : null}
        {loadError ? <Pressable accessibilityRole="button" onPress={() => void refresh(true)} style={{ minHeight: 44, justifyContent: 'center', marginBottom: 8 }}><Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>{t('retry')}</Text></Pressable> : null}
        {isLoading ? <ActivityIndicator color={colors.accent} /> : !data && loadError ? null : requests.length === 0
          ? <View style={{ ...card, padding: 22, alignItems: 'center' }}><Ionicons name="calendar-outline" size={32} color={colors.muted} /><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15, marginTop: 10 }}>{t('noLeave')}</Text><Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: 'center' }}>{t('noLeaveBody')}</Text></View>
          : requests.map((request) => {
            const tone = request.status === 'approved' ? colors.success : request.status === 'rejected' ? colors.danger : colors.warning;
            const soft = request.status === 'approved' ? colors.successSoft : request.status === 'rejected' ? colors.dangerSoft : colors.warningSoft;
            return <View key={request.id} style={{ ...card, padding: 14, marginBottom: 12, flexDirection: 'row', gap: 12 }}>
              <View style={tile}><Ionicons name="calendar-outline" size={22} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15, flexShrink: 1 }}>{leaveLabels[request.leaveType] ?? request.leaveType}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: soft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}><Ionicons name={statusIcon(request.status)} size={14} color={tone} /><Text style={{ color: tone, fontSize: 12, fontWeight: '800' }}>{t(request.status)}</Text></View>
                </View>
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 4 }}>{request.startDate} – {request.endDate}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{request.reason}</Text>
              </View>
            </View>;
          })}
      </View>
    </ScrollView>
  );
}
