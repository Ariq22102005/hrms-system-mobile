import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing } from '../theme';
import { ThemeColors, useTheme, useThemedStyles } from '../context/ThemeContext';
import Toolbar from './Toolbar';

type ScreenHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  hideProfile?: boolean;
  onBack?: () => void;
  backLabel?: string;
};

export default function ScreenHeader({ eyebrow, title, subtitle, hideProfile, onBack, backLabel }: ScreenHeaderProps) {
  const styles = useThemedStyles(makeStyles); const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Toolbar hideProfile={hideProfile} />
      {onBack ? <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, marginBottom: 4 }}><Ionicons name="chevron-back" size={22} color={colors.accent} /><Text style={{ color: colors.accent, fontWeight: '700' }}>{backLabel}</Text></Pressable> : null}
      <View style={styles.hero}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { marginBottom: spacing.lg },
  hero: { backgroundColor: colors.primary, padding: 24, borderRadius: 24 },
  eyebrow: { color: colors.onPrimary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: colors.onPrimary, fontSize: 26, fontWeight: '800', marginTop: 6 },
  subtitle: { color: colors.onPrimary, fontSize: 13, lineHeight: 20, marginTop: 8 },
});
