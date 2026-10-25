import { StyleSheet, Text } from 'react-native';

import { spacing } from '../theme';
import { ThemeColors, useThemedStyles } from '../context/ThemeContext';

export default function SectionTitle({ children }: { children: string }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.title}>{children}</Text>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  title: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: spacing.sm },
});
