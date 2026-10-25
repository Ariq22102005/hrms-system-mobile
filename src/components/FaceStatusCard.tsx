import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFaceStatus } from '../context/FaceStatusContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

type Props = { onOpen: () => void; /** Home hides the card once approved; Profile keeps showing it. */ hideWhenApproved?: boolean; /** Home: a big first-step card when the employee has not registered a face yet. */ prominent?: boolean };
export default function FaceStatusCard({ onOpen, hideWhenApproved = false, prominent = false }: Props) {
  const { info, faceStatus, error, loading, refresh } = useFaceStatus(); const { t } = useLanguage(); const { colors } = useTheme();
  const shell = { borderRadius: 20, padding: 18, borderWidth: 1, marginBottom: 16 };
  const cta = { minHeight: 48, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary, marginTop: 14, paddingHorizontal: 16 };

  if (!faceStatus) {
    if (loading) return <View style={[shell, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', gap: 10, alignItems: 'center' }]}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.muted }}>{t('feStatusLoading')}</Text></View>;
    return error ? <View accessibilityRole="alert" style={[shell, { backgroundColor: colors.warningSoft, borderColor: colors.border }]}><Text style={{ color: colors.warning, lineHeight: 21 }}>{t('feStatusError')}</Text><Pressable accessibilityRole="button" onPress={() => void refresh()} style={cta}><Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{t('retry')}</Text></Pressable></View> : null;
  }
  if (faceStatus === 'approved') {
    if (hideWhenApproved) return null;
    return <View style={[shell, { backgroundColor: colors.successSoft, borderColor: colors.border, flexDirection: 'row', gap: 12 }]}><Ionicons name="checkmark-circle" size={26} color={colors.success} /><View style={{ flex: 1 }}><Text style={{ color: colors.success, fontWeight: '800' }}>{t('feApprovedTitle')}</Text><Text style={{ color: colors.ink, marginTop: 4, lineHeight: 20 }}>{t('feApprovedBody')}</Text></View></View>;
  }
  if (faceStatus === 'pending') {
    return <View style={[shell, { backgroundColor: colors.warningSoft, borderColor: colors.border }]}>
      <View style={{ flexDirection: 'row', gap: 12 }}><Ionicons name="time-outline" size={26} color={colors.warning} /><View style={{ flex: 1 }}><Text style={{ color: colors.warning, fontWeight: '800' }}>{t('fePendingTitle')}</Text><Text style={{ color: colors.ink, marginTop: 4, lineHeight: 20 }}>{t('fePendingBody')}</Text></View></View>
      <Pressable accessibilityRole="button" onPress={onOpen} style={[cta, { backgroundColor: colors.primarySoft }]}><Text style={{ color: colors.accent, fontWeight: '800' }}>{t('feViewStatus')}</Text></Pressable>
    </View>;
  }
  if (faceStatus === 'none' && prominent) {
    return <View style={[shell, { backgroundColor: colors.primary, borderColor: colors.primary, padding: 20 }]}>
      <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}><Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '700' }}>{t('feOnbBadge')}</Text></View>
      <Text accessibilityRole="header" style={{ color: colors.onPrimary, fontSize: 22, fontWeight: '800', marginTop: 12 }}>{t('feOnbTitle')}</Text>
      <Text style={{ color: colors.onPrimary, lineHeight: 22, marginTop: 8 }}>{t('feOnbBody')}</Text>
      <View style={{ gap: 10, marginTop: 14 }}>{(['feOnbStep1', 'feOnbStep2', 'feOnbStep3'] as const).map((key, index) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.onPrimary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '800' }}>{index + 1}</Text></View><Text style={{ color: colors.onPrimary, flex: 1 }}>{t(key)}</Text></View>)}</View>
      <Pressable accessibilityRole="button" onPress={onOpen} style={[cta, { backgroundColor: colors.onPrimary, marginTop: 18 }]}><Text style={{ color: colors.primary, fontWeight: '800' }}>{t('feOnbCta')}</Text></Pressable>
    </View>;
  }
  const rejected = faceStatus === 'rejected';
  return <View style={[shell, { backgroundColor: rejected ? colors.dangerSoft : colors.surface, borderColor: colors.border }]}>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Ionicons name={rejected ? 'alert-circle' : 'scan-outline'} size={26} color={rejected ? colors.danger : colors.accent} />
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ color: rejected ? colors.danger : colors.ink, fontWeight: '800' }}>{t(rejected ? 'feRejectedTitle' : 'feCardTitle')}</Text>
        {rejected ? <Text style={{ color: colors.ink, marginTop: 6, lineHeight: 20 }}><Text style={{ fontWeight: '800' }}>{t('feRejectedReason')}: </Text>{info?.rejection_reason || '—'}</Text> : null}
        <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>{t('feCardBody')}</Text>
      </View>
    </View>
    <Pressable accessibilityRole="button" onPress={onOpen} style={cta}><Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{t(rejected ? 'feRejectedCta' : 'feCardCta')}</Text></Pressable>
  </View>;
}
