import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import EmployeeAvatar from './EmployeeAvatar';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { EmployeeTabParamList } from '../navigation/AppNavigator';
// Only rendered when signed in, i.e. inside the tab navigator (the login screen has no navigation context).
function ProfileButton({ style }: { style: object }) {
  const navigation = useNavigation<BottomTabNavigationProp<EmployeeTabParamList>>(); const { t } = useLanguage();
  return <Pressable accessibilityRole="button" accessibilityLabel={t('profileTitle')} onPress={() => navigation.navigate('Profile')} style={style}><EmployeeAvatar size={34} /></Pressable>;
}
export default function Toolbar({ hideProfile = false, onPrimary = false }: { hideProfile?: boolean; onPrimary?: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  const { dark, toggle, colors } = useTheme();
  const { employee } = useAuth();
  const { data, error, refresh } = useData();
  const [visible, setVisible] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const unread = data?.notifications.filter((n) => !n.read).length ?? 0;
  const button = { minHeight: 44, minWidth: 44, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 12, backgroundColor: colors.surface };
  async function read(id: string) { try { await api.readNotification(id); await refresh(true); setReadError(null); } catch (e) { setReadError(e instanceof Error ? e.message : t('saveError')); } }
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t(dark ? 'lightMode' : 'darkMode')} onPress={toggle} style={button}><Ionicons name={dark ? 'sunny-outline' : 'moon-outline'} size={23} color={colors.ink} /></Pressable>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View accessibilityLabel={t('language')} style={{ flexDirection: 'row', padding: 2, borderRadius: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}>{(['id', 'en'] as const).map((lang) => <Pressable key={lang} accessibilityRole="button" accessibilityLabel={lang === 'id' ? 'Bahasa Indonesia' : 'English'} accessibilityState={{ selected: language === lang }} onPress={() => setLanguage(lang)} style={[button, { backgroundColor: language === lang ? colors.primary : colors.surface }]}><Text style={{ color: language === lang ? '#FFFFFF' : colors.muted, fontWeight: '800' }}>{lang.toUpperCase()}</Text></Pressable>)}</View>
        {employee ? <Pressable accessibilityRole="button" accessibilityLabel={`${t('notifications')} (${unread})`} onPress={() => setVisible(true)} style={button}><Ionicons name="notifications-outline" size={24} color={colors.ink} />{unread > 0 ? <View style={{ position: 'absolute', right: 5, top: 5, borderRadius: 10, backgroundColor: colors.danger, paddingHorizontal: 4 }}><Text style={{ color: '#FFFFFF', fontSize: 10 }}>{unread}</Text></View> : null}</Pressable> : null}
        {employee && !hideProfile ? <ProfileButton style={button} /> : null}
      </View>
    </View>
    {employee && error ? <Text accessibilityRole="alert" style={{ color: onPrimary ? colors.onPrimary : colors.danger, fontWeight: onPrimary ? '700' : '400', marginBottom: 12, lineHeight: 20 }}>{t('syncError')} {error}</Text> : null}
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Math.max(insets.bottom, 16) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 22 }}>{t('notifications')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={() => setVisible(false)} style={button}><Ionicons name="close" size={28} color={colors.ink} /></Pressable></View>
          <ScrollView><Text style={{ color: colors.muted, marginVertical: 12 }}>{t('notificationHint')}</Text>{readError ? <Text style={{ color: colors.danger }}>{readError}</Text> : null}
            {!data?.notifications.length ? <Text style={{ color: colors.muted, paddingVertical: 24 }}>{t('noNotifications')}</Text> : data.notifications.map((n) => <Pressable accessibilityRole="button" key={n.id} onPress={() => !n.read && void read(n.id)} style={{ paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}><Text style={{ color: colors.ink, fontWeight: n.read ? '500' : '800' }}>{n.title}{!n.read ? ' •' : ''}</Text><Text style={{ color: colors.muted, lineHeight: 21, marginTop: 6 }}>{n.message}</Text><Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>{new Date(n.created_at).toLocaleString(language === 'en' ? 'en-GB' : 'id-ID')}</Text></Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
