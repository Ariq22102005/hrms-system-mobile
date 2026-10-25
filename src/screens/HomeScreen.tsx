import { Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toolbar from '../components/Toolbar';
import AttendanceSummaryCard from '../components/AttendanceSummaryCard';
import FaceStatusCard from '../components/FaceStatusCard';
import SharedDrive from '../components/SharedDrive';
import { useAuth } from '../context/AuthContext';
import { useFaceStatus } from '../context/FaceStatusContext';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { EmployeeTabParamList } from '../navigation/AppNavigator';
import { attendanceSummary, formatDuration } from '../services/attendanceSummary';
import { useClock } from '../services/useClock';

const PAD = 20;
// Gradients use React Native's built-in `experimental_backgroundImage` (CSS syntax), so no extra native library is needed.
// Every gradient sits on a solid backgroundColor: if a device ignores the gradient, the plain brand colour shows instead.
const brandGradient = 'linear-gradient(135deg, #4A050E 0%, #8B0D1A 52%, #C4202F 100%)';
const wineGradient = 'linear-gradient(155deg, #2A0A10 0%, #5C0711 100%)';
const glow = 'radial-gradient(circle, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 70%)';
const gradient = (value: string) => ({ experimental_backgroundImage: value }) as const;
const glass = { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' } as const;
const press = (pressed: boolean, scale = 0.97) => ({ transform: [{ scale: pressed ? scale : 1 }], opacity: pressed ? 0.92 : 1 }) as const;

export default function HomeScreen() {
  const { employee } = useAuth(); const { data } = useData(); const { t, language } = useLanguage(); const { colors } = useTheme();
  const { faceStatus } = useFaceStatus(); const firstTime = faceStatus === 'none';
  const navigation = useNavigation<BottomTabNavigationProp<EmployeeTabParamList>>();
  const now = useClock(); const insets = useSafeAreaInsets();
  const summary = attendanceSummary(data?.attendance ?? [], now, data?.office.time_zone);
  const timeZone = data?.office.time_zone ?? 'Asia/Jakarta';
  const locale = language === 'en' ? 'en-GB' : 'id-ID';
  const hour = Number(now.toLocaleTimeString('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }));
  const greeting = hour < 11 ? 'goodMorning' : hour < 17 ? 'goodAfternoon' : 'goodEvening';
  const name = (data?.employee ?? employee)?.name;
  const card = { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border } as const;
  const sectionTitle = { color: colors.ink, fontSize: 18, fontWeight: '700' } as const;

  return <ScrollView style={{ backgroundColor: colors.background }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
    {/* Header: brand gradient with soft glows; controls, who is signed in, and the clock */}
    <View style={{ backgroundColor: '#8B0D1A', ...gradient(brandGradient), borderBottomLeftRadius: 36, borderBottomRightRadius: 36, paddingHorizontal: PAD, paddingTop: insets.top + 12, paddingBottom: 72, overflow: 'hidden' }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', right: -70, top: -90, width: 300, height: 300, borderRadius: 150, ...gradient(glow) }} />
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', left: -90, bottom: -110, width: 260, height: 260, borderRadius: 130, opacity: 0.7, ...gradient(glow) }} />
      <Toolbar hideProfile onPrimary />
      <Pressable accessibilityRole="button" accessibilityLabel={t('profileTitle')} accessibilityHint={name} onPress={() => navigation.navigate('Profile')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, ...press(pressed, 0.98) })}>
        <View style={{ width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...glass }}><Ionicons name="person-outline" size={22} color={colors.onPrimary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onPrimary, fontSize: 13, opacity: 0.85 }}>{t(greeting)}</Text>
          <Text numberOfLines={1} style={{ color: colors.onPrimary, fontSize: 20, fontWeight: '700', marginTop: 2 }}>{name}</Text>
        </View>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', ...glass }}><Ionicons name="chevron-forward" size={20} color={colors.onPrimary} /></View>
      </Pressable>
      <Text maxFontSizeMultiplier={1.25} style={{ color: colors.onPrimary, fontSize: 58, fontWeight: '700', letterSpacing: -2.5, marginTop: 22 }}>{now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone })}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginTop: 6, ...glass }}>
        <Ionicons name="calendar-outline" size={16} color={colors.onPrimary} />
        <Text style={{ color: colors.onPrimary, fontSize: 13 }}>{now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone })}</Text>
      </View>
    </View>

    <View style={{ paddingHorizontal: PAD }}>
      {/* First login: the face registration card leads. Otherwise the attendance card leads. */}
      {firstTime ? <View style={{ marginTop: -50 }}><FaceStatusCard prominent onOpen={() => navigation.navigate('FaceEnrollment', { returnTo: 'Home' })} /></View> : null}
      <View style={{ marginTop: firstTime ? 0 : -50 }}><AttendanceSummaryCard now={now} onAttend={() => navigation.navigate('Attendance')} /></View>

      {/* Face registration: appears until the face is approved by HR */}
      {firstTime ? null : <FaceStatusCard hideWhenApproved onOpen={() => navigation.navigate('FaceEnrollment', { returnTo: 'Home' })} />}

      {/* Stats: one dark gradient card next to one soft tinted card for contrast */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 30 }}>
        <View accessible accessibilityLabel={`${t('monthlyHours')}, ${t('thisMonth')}: ${data ? formatDuration(summary.monthlyMs) : '-'}`} style={{ flex: 1.25, minHeight: 158, borderRadius: 24, padding: 18, overflow: 'hidden', justifyContent: 'space-between', backgroundColor: '#2A0A10', ...gradient(wineGradient) }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', right: -50, top: -50, width: 190, height: 190, borderRadius: 95, ...gradient(glow) }} />
          <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...glass }}><Ionicons name="time-outline" size={22} color="#FFFFFF" /></View>
          <View>
            <Text maxFontSizeMultiplier={1.25} style={{ color: '#FFFFFF', fontSize: 38, fontWeight: '700', letterSpacing: -1 }}>{data ? formatDuration(summary.monthlyMs) : '—'}</Text>
            <Text style={{ color: '#D9C9CB', fontSize: 13, marginTop: 2 }}>{t('monthlyHours')} · {t('thisMonth')}</Text>
          </View>
        </View>
        <View accessible accessibilityLabel={`${t('daysPresent')}, ${t('thisMonth')}: ${data ? summary.daysPresent : '-'}`} style={{ flex: 1, minHeight: 158, borderRadius: 24, padding: 18, justifyContent: 'space-between', backgroundColor: colors.primarySoft }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}><Ionicons name="calendar-outline" size={22} color={colors.accent} /></View>
          <View>
            <Text maxFontSizeMultiplier={1.25} style={{ color: colors.accent, fontSize: 38, fontWeight: '700', letterSpacing: -1 }}>{data ? String(summary.daysPresent) : '—'}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{t('daysPresent')}</Text>
          </View>
        </View>
      </View>

      <Text accessibilityRole="header" style={{ ...sectionTitle, marginBottom: 14 }}>{t('latestInformation')}</Text>
      <SharedDrive />
      {data?.payroll[0] ? <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Payroll')} style={({ pressed }) => ({ ...card, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, marginBottom: 12, ...press(pressed) })}>
        <View style={{ width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8B0D1A', ...gradient(brandGradient) }}><Ionicons name="wallet-outline" size={26} color="#FFFFFF" /></View>
        <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: '700', fontSize: 15 }}>{t('payrollRecordAvailable')}</Text><Text style={{ color: colors.muted, marginTop: 2, fontSize: 13 }}>{data.payroll[0].period}</Text></View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable> : null}
      {data?.overtime.length ? data.overtime.slice(0, 5).map((o) => <View key={o.id} style={{ backgroundColor: colors.warningSoft, borderRadius: 20, borderLeftWidth: 5, borderLeftColor: colors.warning, padding: 16, marginBottom: 12 }}>
        <Text style={{ color: colors.warning, fontWeight: '700', fontSize: 15 }}>{t('overtime')}</Text>
        <Text style={{ color: colors.ink, marginTop: 4, fontSize: 14, fontWeight: '500' }}>{o.date} · {o.start_time}–{o.end_time}</Text>
        <Text style={{ color: colors.muted, marginTop: 4, fontSize: 13 }}>{o.description}</Text>
      </View>) : <Text style={{ color: colors.muted, fontSize: 14 }}>{t('overtimeEmpty')}</Text>}
    </View>
  </ScrollView>;
}
