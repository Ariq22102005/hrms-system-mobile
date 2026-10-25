import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmployeeAvatar from '../components/EmployeeAvatar';
import FaceStatusCard from '../components/FaceStatusCard';
import Toolbar from '../components/Toolbar';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { EmployeeTabParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { attendanceSummary, formatDuration } from '../services/attendanceSummary';

const PAD = 20;
type Tab = 'personal' | 'work' | 'face';

export default function ProfileScreen() {
  const { employee, signOut, updateEmployee } = useAuth(); const { data, refresh } = useData(); const { t, language } = useLanguage(); const { colors } = useTheme(); const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<EmployeeTabParamList>>();
  const profile = data?.employee ?? employee;
  const [name, setName] = useState(profile?.name ?? ''); const [phone, setPhone] = useState(profile?.phone ?? '');
  const [dirty, setDirty] = useState(false); const [saving, setSaving] = useState(false); const lock = useRef(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('personal');
  useEffect(() => { if (!dirty) { setName(profile?.name ?? ''); setPhone(profile?.phone ?? ''); } }, [profile?.name, profile?.phone, dirty]);
  async function save() {
    if (lock.current || !editing) return;
    if (name.trim().length < 2 || name.trim().length > 100 || (phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(phone.trim()))) { setMessage(t('profileInvalid')); return; }
    lock.current = true; setSaving(true); setMessage(null);
    try { const result = await api.updateEmployee({ name: name.trim(), phone: phone.trim() }); updateEmployee(result); await refresh(true); setDirty(false); setEditing(false); setMessage(t('profileSaved')); }
    catch (e) { setMessage(e instanceof Error ? e.message : t('saveError')); }
    finally { lock.current = false; setSaving(false); }
  }
  const startEditing = () => { setName(profile?.name ?? ''); setPhone(profile?.phone ?? ''); setDirty(false); setMessage(null); setEditing(true); setTab('personal'); };
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'));

  // Presentation only: a few numbers for the profile header, taken from data the app already loads.
  const en = language === 'en';
  const summary = attendanceSummary(data?.attendance ?? [], new Date(), data?.office.time_zone);
  const approvedLeaves = (data?.leaves ?? []).filter((leave) => leave.status === 'approved').length;
  const stats = [[t('daysPresent'), String(summary.daysPresent)], [t('monthlyHours'), formatDuration(summary.monthlyMs)], [en ? 'Approved leave' : 'Cuti disetujui', String(approvedLeaves)]] as const;
  const tabs = [['personal', en ? 'Personal' : 'Pribadi'], ['work', en ? 'Work' : 'Pekerjaan'], ['face', en ? 'Face' : 'Wajah']] as const;
  const workRows = [['id-card-outline', t('employeeId'), profile?.id], ['mail-outline', t('email'), profile?.email], ['briefcase-outline', t('role'), profile?.role], ['business-outline', t('division'), profile?.division]] as const;

  const label = { color: colors.muted, fontSize: 13, fontWeight: '700' as const, marginBottom: 8, marginTop: 18 };
  const input = { color: colors.ink, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 50, fontSize: 15 };
  const card = { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 20 } as const;
  const tile = { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' } as const;

  return <ScrollView style={{ backgroundColor: colors.background }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: colors.background }}>
    {/* Cover */}
    <View style={{ backgroundColor: colors.primary, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: PAD, paddingTop: insets.top + 12, paddingBottom: 92, overflow: 'hidden' }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', right: -30, top: 30, opacity: 0.1 }}><Ionicons name="person" size={220} color={colors.onPrimary} /></View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', left: -50, bottom: -40, width: 150, height: 150, borderRadius: 75, borderWidth: 18, borderColor: colors.onPrimary, opacity: 0.08 }} />
      <Toolbar hideProfile onPrimary />
      <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Back' : 'Kembali'} onPress={goBack} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, alignSelf: 'flex-start' }}><Ionicons name="chevron-back" size={22} color={colors.onPrimary} /><Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{en ? 'Back' : 'Kembali'}</Text></Pressable>
    </View>

    {/* Avatar overlapping the cover, edit button on the right */}
    <View style={{ marginTop: -68, alignItems: 'center' }}>
      <View style={{ width: 128, height: 128, borderRadius: 64, borderWidth: 4, borderColor: colors.primary, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}><EmployeeAvatar size={112} /></View>
      {!editing ? <Pressable accessibilityRole="button" onPress={startEditing} style={({ pressed }) => ({ position: 'absolute', right: PAD, top: 80, minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}><Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{t('editProfile')}</Text></Pressable> : null}
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={{ color: colors.accent, fontSize: 24, fontWeight: '800', marginTop: 12, textAlign: 'center', paddingHorizontal: PAD }}>{profile?.name}</Text>
      <Text style={{ color: colors.muted, fontSize: 15, marginTop: 4, textAlign: 'center' }}>{profile?.role}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}><Ionicons name="business" size={18} color={colors.primary} /><Text style={{ color: colors.ink, fontSize: 15 }}>{profile?.division}</Text></View>
    </View>

    {/* Stats */}
    <View style={{ flexDirection: 'row', paddingHorizontal: PAD, marginTop: 22 }}>
      {stats.map(([caption, value]) => <View key={caption} accessible accessibilityLabel={`${caption}: ${data ? value : '-'}`} style={{ flex: 1, alignItems: 'center' }}>
        <Text maxFontSizeMultiplier={1.3} style={{ color: colors.accent, fontSize: 22, fontWeight: '800' }}>{data ? value : '—'}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>{caption}</Text>
      </View>)}
    </View>

    {/* Tabs */}
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', marginTop: 24, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
      {tabs.map(([key, title]) => { const selected = tab === key; return <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setTab(key)} style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: selected ? colors.accent : 'transparent' }}><Text style={{ color: selected ? colors.accent : colors.muted, fontSize: 15, fontWeight: selected ? '800' : '600' }}>{title}</Text></Pressable>; })}
    </View>

    <View style={{ paddingHorizontal: PAD, paddingTop: 20 }}>
      {tab === 'personal' ? <View style={card}>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{t('photoManaged')}</Text>
        {editing ? <>
        <Text style={label}>{t('name')}</Text><TextInput accessibilityLabel={t('name')} editable={!saving} value={name} maxLength={100} onChangeText={(v) => { setName(v); setDirty(true); }} style={input} />
        <Text style={label}>{t('phone')}</Text><TextInput accessibilityLabel={t('phone')} editable={!saving} value={phone} maxLength={20} keyboardType="phone-pad" onChangeText={(v) => { setPhone(v); setDirty(true); }} style={input} />
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 10 }}>{t('editableHint')}</Text>
        <Pressable accessibilityRole="button" disabled={!dirty || saving} onPress={save} style={{ minHeight: 52, backgroundColor: colors.primary, opacity: !dirty || saving ? 0.5 : 1, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{t('saveProfile')}</Text>}</Pressable>
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setDirty(false); setEditing(false); setMessage(null); }} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.muted, fontWeight: '700' }}>{t('cancel')}</Text></Pressable>
        </> : <>
        {[['person-outline', t('name'), profile?.name], ['call-outline', t('phone'), profile?.phone || '—']].map(([icon, key, value]) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}><View style={tile}><Ionicons name={icon as 'person-outline'} size={22} color={colors.accent} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 13 }}>{key}</Text><Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 2 }}>{value}</Text></View></View>)}
        </>}
        {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.ink, marginTop: 14, lineHeight: 20 }}>{message}</Text> : null}
      </View> : null}

      {tab === 'work' ? <View style={card}>
        {workRows.map(([icon, key, value], index) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: index === 0 ? 0 : 16, marginTop: index === 0 ? 0 : 16, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }}><View style={tile}><Ionicons name={icon} size={22} color={colors.accent} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 13 }}>{key}</Text><Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 2 }}>{value}</Text></View></View>)}
      </View> : null}

      {tab === 'face' ? <FaceStatusCard onOpen={() => navigation.navigate('FaceEnrollment', { returnTo: 'Profile' })} /> : null}

      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={({ pressed }) => ({ minHeight: 52, borderWidth: 1, borderColor: colors.danger, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24, opacity: pressed ? 0.85 : 1 })}><Text style={{ color: colors.danger, fontWeight: '800', fontSize: 15 }}>{t('signOut')}</Text></Pressable>
    </View>
  </ScrollView>;
}
