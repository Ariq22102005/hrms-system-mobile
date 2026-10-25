import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { attendanceSummary, formatDuration } from '../services/attendanceSummary';
export default function AttendanceSummaryCard({ now, onAttend, disabled = false }: { now: Date; onAttend?: () => void; disabled?: boolean }) {
  const { data } = useData(); const { colors } = useTheme(); const { t, language } = useLanguage();
  const summary = attendanceSummary(data?.attendance ?? [], now, data?.office.time_zone);
  const format = (s?: string) => s ? new Date(s).toLocaleTimeString(language === 'en' ? 'en-GB' : 'id-ID', { timeZone: data?.office.time_zone ?? 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) : '--:--';
  return <View style={{ backgroundColor: colors.surface, borderRadius: 24, borderColor: colors.border, borderWidth: 1, padding: 20, marginBottom: 16 }}>
    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{t('attendanceToday')}</Text>
    <Text style={{ color: summary.checkIn ? colors.success : colors.danger, fontWeight: '700', marginTop: 8 }}>{!data ? t('preparing') : summary.checkOut ? t('completeToday') : summary.checkIn ? t('present') : t('notCheckedIn')}</Text>
    <View style={{ flexDirection: 'row', marginVertical: 16 }}>{([
      ['log-in-outline', t('checkIn'), format(summary.checkIn?.recorded_at)], ['log-out-outline', t('checkOut'), format(summary.checkOut?.recorded_at)], ['time-outline', t('workHours'), formatDuration(summary.durationMs)],
    ] as const).map(([icon, label, value]) => <View key={label} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 3 }}><View style={{ borderRadius: 14, backgroundColor: colors.primarySoft, padding: 10 }}><Ionicons name={icon} size={20} color={colors.accent} /></View><Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 12 }}>{value}</Text><Text style={{ color: colors.muted, textAlign: 'center', fontSize: 12, marginTop: 6 }}>{label}</Text></View>)}</View>
    {onAttend ? <Pressable accessibilityRole="button" disabled={disabled || !data || !!summary.checkOut} onPress={onAttend} style={{ opacity: disabled || !data || summary.checkOut ? 0.5 : 1, minHeight: 54, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', padding: 12 }}><Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 17 }}>{summary.checkOut ? t('completeToday') : summary.checkIn ? t('checkOutLabel') : t('checkInLabel')}</Text></Pressable> : null}
  </View>;
}
