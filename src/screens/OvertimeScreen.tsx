import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StatusNotice, { NoticeTone } from '../components/StatusNotice';
import Toolbar from '../components/Toolbar';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { api, createRequestId, OvertimeDto } from '../services/api';
import { dateKey } from '../services/attendanceSummary';
import { DATE_WINDOW_DAYS, DraftError, durationMinutes, endAfter, formatMinutes, MAX_DESCRIPTION, minutesToTime, shiftTime, timeToMinutes, validateDraft } from '../services/overtimeRequest';

const PAD = 20;
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// --- calendar math on YYYY-MM-DD keys in UTC, so time zones never move a day ---
const toDate = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (key: string, n: number) => { const d = toDate(key); d.setUTCDate(d.getUTCDate() + n); return toKey(d); };
type Tone = 'approved' | 'pending' | 'rejected';
const strength: Record<Tone, number> = { approved: 3, pending: 2, rejected: 1 };
const toneOf = (status: string): Tone => (status === 'pending' ? 'pending' : status === 'rejected' ? 'rejected' : 'approved'); // assigned counts as approved

const text = {
  id: {
    title: 'Lembur', subtitle: 'Ajukan lembur dan pantau statusnya.',
    pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', assigned: 'Ditugaskan', monthHours: 'Jam bulan ini', thisMonth: 'Bulan ini',
    formTitle: 'Ajukan lembur', date: 'Tanggal', dateHelp: 'Ketuk tanggal lembur. Titik menandai lembur yang sudah ada.',
    time: 'Jam lembur', from: 'Mulai', to: 'Selesai', duration: 'Durasi', quick: 'Atur cepat', hours: (n: number) => `${n} jam`,
    earlier: (label: string) => `${label}, mundur 30 menit`, later: (label: string) => `${label}, maju 30 menit`,
    descLabel: 'Keterangan', descPlaceholder: 'Contoh: Menyelesaikan laporan bulanan',
    submit: 'Ajukan lembur', sent: 'Pengajuan lembur terkirim. Menunggu persetujuan.',
    history: 'Riwayat lembur', empty: 'Belum ada lembur', emptyBody: 'Ajukan lembur di atas, atau tunggu penugasan dari admin.',
    reason: 'Alasan', retry: 'Coba lagi', loadError: 'Data lembur belum bisa dimuat.', prev: 'Bulan sebelumnya', next: 'Bulan berikutnya', selected: 'dipilih', outside: 'di luar batas pengajuan',
    errors: { time_order: 'Jam selesai harus setelah jam mulai.', too_long: 'Lembur maksimal 12 jam per pengajuan.', description_required: 'Isi keterangan lembur untuk mengajukan.', description_long: `Keterangan maksimal ${MAX_DESCRIPTION} karakter.`, date_window: `Tanggal harus dalam ${DATE_WINDOW_DAYS} hari dari hari ini.`, overlap: 'Jam ini bertabrakan dengan lembur lain pada tanggal tersebut.' } satisfies Record<DraftError, string>,
  },
  en: {
    title: 'Overtime', subtitle: 'Request overtime and follow its status.',
    pending: 'Pending', approved: 'Approved', rejected: 'Rejected', assigned: 'Assigned', monthHours: 'Hours this month', thisMonth: 'This month',
    formTitle: 'Request overtime', date: 'Date', dateHelp: 'Tap the overtime date. Dots mark existing overtime.',
    time: 'Overtime hours', from: 'From', to: 'To', duration: 'Duration', quick: 'Quick set', hours: (n: number) => `${n} h`,
    earlier: (label: string) => `${label}, 30 minutes earlier`, later: (label: string) => `${label}, 30 minutes later`,
    descLabel: 'Description', descPlaceholder: 'Example: Finishing the monthly report',
    submit: 'Request overtime', sent: 'Overtime request sent. Waiting for approval.',
    history: 'Overtime history', empty: 'No overtime yet', emptyBody: 'Request overtime above, or wait for an assignment from an admin.',
    reason: 'Reason', retry: 'Try again', loadError: 'Overtime data could not be loaded.', prev: 'Previous month', next: 'Next month', selected: 'selected', outside: 'outside the request window',
    errors: { time_order: 'The end time must be after the start time.', too_long: 'Overtime can be at most 12 hours per request.', description_required: 'Add a description to submit.', description_long: `Description can be at most ${MAX_DESCRIPTION} characters.`, date_window: `The date must be within ${DATE_WINDOW_DAYS} days of today.`, overlap: 'These hours overlap other overtime on that date.' } satisfies Record<DraftError, string>,
  },
};

type CalendarProps = { selected: string; month: { y: number; m: number }; today: string; locale: string; min: string; max: string; marks: Map<string, Tone>; onMonth: (delta: number) => void; onPick: (key: string) => void; labels: { prev: string; next: string; selected: string; outside: string; approved: string; pending: string; rejected: string } };
function OvertimeCalendar({ selected, month, today, locale, min, max, marks, onMonth, onPick, labels }: CalendarProps) {
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
        if (!key) return <View key={c} style={{ width: `${100 / 7}%`, height: 48 }} />;
        const disabled = key < min || key > max; const isSelected = key === selected; const mark = marks.get(key); const isToday = key === today;
        const label = `${toDate(key).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}${isSelected ? `, ${labels.selected}` : ''}${mark ? `, ${labels[mark]}` : ''}${disabled ? `, ${labels.outside}` : ''}`;
        return <Pressable key={c} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: isSelected, disabled }} disabled={disabled} onPress={() => onPick(key)} style={{ width: `${100 / 7}%`, height: 48, alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? colors.primary : 'transparent', borderWidth: isToday && !isSelected ? 1.5 : 0, borderColor: colors.accent, opacity: disabled ? 0.35 : 1 }}>
            <Text style={{ color: isSelected ? colors.onPrimary : colors.ink, fontSize: 14, fontWeight: isSelected || isToday ? '800' : '500' }}>{Number(key.slice(8))}</Text>
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

function TimeStepper({ label, value, onEarlier, onLater, earlierLabel, laterLabel }: { label: string; value: string; onEarlier: () => void; onLater: () => void; earlierLabel: string; laterLabel: string }) {
  const { colors } = useTheme();
  const button = { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft } as const;
  return <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 10, alignItems: 'center' }}>
    <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
    <Text accessibilityLiveRegion="polite" accessibilityLabel={`${label} ${value}`} maxFontSizeMultiplier={1.3} style={{ color: colors.ink, fontSize: 24, fontWeight: '800', marginVertical: 6 }}>{value}</Text>
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={earlierLabel} onPress={onEarlier} style={({ pressed }) => ({ ...button, opacity: pressed ? 0.7 : 1 })}><Ionicons name="remove" size={22} color={colors.accent} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={laterLabel} onPress={onLater} style={({ pressed }) => ({ ...button, opacity: pressed ? 0.7 : 1 })}><Ionicons name="add" size={22} color={colors.accent} /></Pressable>
    </View>
  </View>;
}

export default function OvertimeScreen() {
  const { data, error, refresh } = useData(); const { language } = useLanguage(); const { colors } = useTheme(); const insets = useSafeAreaInsets();
  const L = text[language === 'en' ? 'en' : 'id']; const locale = language === 'en' ? 'en-GB' : 'id-ID';
  const today = dateKey(new Date(), data?.office.time_zone);
  const [date, setDate] = useState(today);
  const [start, setStart] = useState('17:00');
  const [end, setEnd] = useState('19:00');
  const [description, setDescription] = useState('');
  const [month, setMonth] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const lock = useRef(false);
  const requestKey = useRef<{ fingerprint: string; key: string } | null>(null);

  const items: OvertimeDto[] = [...(data?.overtime ?? [])].sort((a, b) => `${b.date} ${b.start_time}`.localeCompare(`${a.date} ${a.start_time}`));
  const loading = !data && !error;
  const monthKey = today.slice(0, 7);
  const counted = (o: OvertimeDto) => o.status === 'approved' || o.status === 'assigned';
  const pendingCount = items.filter((o) => o.status === 'pending').length;
  const approvedCount = items.filter(counted).length;
  const monthMinutes = items.filter((o) => counted(o) && o.date.startsWith(monthKey)).reduce((sum, o) => sum + durationMinutes(o.start_time, o.end_time), 0);
  const marks = new Map<string, Tone>();
  for (const o of items) { const tone = toneOf(o.status); const old = marks.get(o.date); if (!old || strength[tone] > strength[old]) marks.set(o.date, tone); }

  const draft = { date, start_time: start, end_time: end, description };
  const draftError = validateDraft(draft, items, today);
  const length = durationMinutes(start, end);

  function moveMonth(delta: number) { setMonth(({ y, m }) => { const d = new Date(Date.UTC(y, m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; }); }
  // Moving the start keeps the same length, so people adjust one control instead of two.
  function moveStart(steps: number) {
    const next = shiftTime(start, steps);
    setStart(next);
    if (length > 0) setEnd(minutesToTime(Math.min(timeToMinutes(next) + length, 23 * 60 + 30)));
  }
  async function onRefresh() { setRefreshing(true); try { await refresh(true); } finally { setRefreshing(false); } }

  async function submit() {
    if (lock.current || draftError) return;
    lock.current = true; setSubmitting(true); setNotice(null);
    const payload = { date, start_time: start, end_time: end, description: description.trim() };
    try {
      const fingerprint = JSON.stringify(payload);
      if (requestKey.current?.fingerprint !== fingerprint) requestKey.current = { fingerprint, key: createRequestId() };
      await api.postOvertimeRequest(payload, requestKey.current.key);
      requestKey.current = null; setDescription(''); setNotice({ tone: 'success', text: L.sent });
      await refresh(true);
    } catch (e) { setNotice({ tone: 'danger', text: e instanceof Error ? e.message : L.loadError }); }
    finally { lock.current = false; setSubmitting(false); }
  }

  const card = { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border } as const;
  const tile = { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' } as const;
  const label = { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 } as const;
  const summary = [
    ['time-outline', L.pending, String(pendingCount), colors.warning],
    ['checkmark-circle-outline', L.approved, String(approvedCount), colors.success],
    ['hourglass-outline', L.monthHours, formatMinutes(monthMinutes, language === 'en' ? 'en' : 'id'), colors.accent],
  ] as const;
  const badge = (status: string) => {
    const map: Record<string, { fg: string; bg: string; icon: 'time-outline' | 'checkmark-circle' | 'close-circle' | 'person-outline'; text: string }> = {
      pending: { fg: colors.warning, bg: colors.warningSoft, icon: 'time-outline', text: L.pending },
      approved: { fg: colors.success, bg: colors.successSoft, icon: 'checkmark-circle', text: L.approved },
      rejected: { fg: colors.danger, bg: colors.dangerSoft, icon: 'close-circle', text: L.rejected },
      assigned: { fg: colors.accent, bg: colors.primarySoft, icon: 'person-outline', text: L.assigned },
    };
    return map[status] ?? { fg: colors.muted, bg: colors.primarySoft, icon: 'time-outline', text: status };
  };
  const canSubmit = !draftError && !submitting;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />} contentContainerStyle={{ paddingBottom: 40, flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
      {/* Header: controls, page title and what this page is for */}
      <View style={{ backgroundColor: colors.primary, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingHorizontal: PAD, paddingTop: insets.top + 12, paddingBottom: 64, overflow: 'hidden' }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', right: -14, bottom: -20, opacity: 0.12 }}><Ionicons name="time" size={160} color={colors.onPrimary} /></View>
        <Toolbar hideProfile onPrimary />
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={{ color: colors.onPrimary, fontSize: 30, fontWeight: '800', marginTop: 8 }}>{L.title}</Text>
        <Text style={{ color: colors.onPrimary, fontSize: 14, lineHeight: 21, marginTop: 6, maxWidth: 420 }}>{L.subtitle}</Text>
      </View>

      <View style={{ paddingHorizontal: PAD }}>
        {/* Overview card overlapping the header */}
        <View style={{ ...card, marginTop: -40, flexDirection: 'row', paddingVertical: 16, marginBottom: 24 }}>
          {summary.map(([icon, caption, value, tone], index) => <View key={caption} accessible accessibilityLabel={`${caption}: ${data ? value : '-'}`} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 6, borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: colors.border }}>
            <Ionicons name={icon} size={20} color={tone} />
            <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 4, maxWidth: '100%' }}>{data ? value : '—'}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, textAlign: 'center' }}>{caption}</Text>
          </View>)}
        </View>

        {/* New request */}
        <View style={{ ...card, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={tile}><Ionicons name="create-outline" size={24} color={colors.accent} /></View>
            <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontWeight: '800', flex: 1 }}>{L.formTitle}</Text>
          </View>

          <Text style={{ ...label, marginBottom: 4 }}>{L.date}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>{L.dateHelp}</Text>
          <View style={{ backgroundColor: colors.background, borderRadius: 18, padding: 12 }}>
            <OvertimeCalendar selected={date} month={month} today={today} locale={locale} min={addDays(today, -DATE_WINDOW_DAYS)} max={addDays(today, DATE_WINDOW_DAYS)} marks={marks} onMonth={moveMonth} onPick={setDate}
              labels={{ prev: L.prev, next: L.next, selected: L.selected, outside: L.outside, approved: L.approved, pending: L.pending, rejected: L.rejected }} />
          </View>
          <Text accessibilityLiveRegion="polite" style={{ color: colors.accent, fontSize: 14, fontWeight: '800', marginTop: 12 }}>{sentence(toDate(date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }))}</Text>

          <Text style={label}>{L.time}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TimeStepper label={L.from} value={start} onEarlier={() => moveStart(-1)} onLater={() => moveStart(1)} earlierLabel={L.earlier(L.from)} laterLabel={L.later(L.from)} />
            <TimeStepper label={L.to} value={end} onEarlier={() => setEnd(shiftTime(end, -1))} onLater={() => setEnd(shiftTime(end, 1))} earlierLabel={L.earlier(L.to)} laterLabel={L.later(L.to)} />
          </View>
          <View accessible accessibilityLabel={`${L.duration}: ${length > 0 ? formatMinutes(length, language === 'en' ? 'en' : 'id') : '-'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <Ionicons name="hourglass-outline" size={18} color={colors.accent} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>{L.duration}</Text>
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '800' }}>{length > 0 ? formatMinutes(length, language === 'en' ? 'en' : 'id') : '—'}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 14, marginBottom: 8 }}>{L.quick}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4].map((hours) => {
              const target = endAfter(start, hours); const active = target !== null && target === end;
              return <Pressable key={hours} accessibilityRole="button" accessibilityState={{ selected: active, disabled: target === null }} disabled={target === null} onPress={() => target && setEnd(target)} style={({ pressed }) => ({ minHeight: 44, minWidth: 64, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.surface, alignItems: 'center', justifyContent: 'center', opacity: target === null ? 0.4 : pressed ? 0.8 : 1 })}>
                <Text style={{ color: active ? colors.onPrimary : colors.ink, fontWeight: '700', fontSize: 14 }}>{L.hours(hours)}</Text>
              </Pressable>;
            })}
          </View>

          <Text style={label}>{L.descLabel}</Text>
          <TextInput accessibilityLabel={L.descLabel} multiline numberOfLines={3} maxLength={MAX_DESCRIPTION + 50} value={description} onChangeText={setDescription} placeholder={L.descPlaceholder} placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, color: colors.ink, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, minHeight: 96, textAlignVertical: 'top' }} />
          <Text style={{ color: description.length > MAX_DESCRIPTION ? colors.danger : colors.muted, fontSize: 12, textAlign: 'right', marginTop: 6 }}>{description.length}/{MAX_DESCRIPTION}</Text>

          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSubmit }} disabled={!canSubmit} onPress={() => void submit()} style={({ pressed }) => ({ minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary, marginTop: 14, opacity: !canSubmit ? 0.5 : pressed ? 0.85 : 1 })}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{L.submit}</Text>}
          </Pressable>
          {draftError ? <Text accessibilityLiveRegion="polite" style={{ color: draftError === 'description_required' ? colors.muted : colors.warning, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10 }}>{L.errors[draftError]}</Text> : null}
          {notice ? <StatusNotice tone={notice.tone}>{notice.text}</StatusNotice> : null}
        </View>

        {/* History */}
        <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 28, marginBottom: 12 }}>{L.history}</Text>
        {error && !data ? <><Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13, lineHeight: 19, marginBottom: 8 }}>{L.loadError} {error}</Text><Pressable accessibilityRole="button" onPress={() => void refresh(true)} style={{ minHeight: 44, justifyContent: 'center', marginBottom: 8 }}><Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>{L.retry}</Text></Pressable></> : null}
        {loading ? <ActivityIndicator color={colors.accent} /> : !data && error ? null : items.length === 0
          ? <View style={{ ...card, padding: 22, alignItems: 'center' }}><Ionicons name="time-outline" size={32} color={colors.muted} /><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15, marginTop: 10 }}>{L.empty}</Text><Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: 'center' }}>{L.emptyBody}</Text></View>
          : items.map((o) => {
            const b = badge(o.status);
            return <View key={o.id} style={{ ...card, padding: 14, marginBottom: 12, flexDirection: 'row', gap: 12 }}>
              <View style={tile}><Ionicons name="time-outline" size={22} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15, flexShrink: 1 }}>{sentence(new Date(`${o.date}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }))}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: b.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}><Ionicons name={b.icon} size={14} color={b.fg} /><Text style={{ color: b.fg, fontSize: 12, fontWeight: '800' }}>{b.text}</Text></View>
                </View>
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 4 }}>{o.start_time}–{o.end_time} · {formatMinutes(durationMinutes(o.start_time, o.end_time), language === 'en' ? 'en' : 'id')}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{o.description}</Text>
                {o.status === 'rejected' && o.rejection_reason ? <Text style={{ color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{L.reason}: {o.rejection_reason}</Text> : null}
              </View>
            </View>;
          })}
      </View>
    </ScrollView>
  );
}
