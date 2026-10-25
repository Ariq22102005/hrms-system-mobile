import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export type NoticeTone = 'success' | 'warning' | 'danger';
export default function StatusNotice({ children, tone = 'warning' }: { children: string; tone?: NoticeTone }) {
  const { colors } = useTheme();
  const background = tone === 'success' ? colors.successSoft : tone === 'danger' ? colors.dangerSoft : colors.warningSoft;
  const icon = tone === 'success' ? 'checkmark-circle' : tone === 'danger' ? 'alert-circle' : 'time-outline';
  return <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, backgroundColor: background, marginVertical: 10 }}>
    <Ionicons name={icon} size={21} color={colors[tone]} />
    <Text style={{ flex: 1, color: colors[tone], lineHeight: 21, fontSize: 13, fontWeight: '600' }}>{children}</Text>
  </View>;
}
