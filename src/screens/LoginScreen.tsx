import { useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { shadow, spacing } from '../theme';
import { ThemeColors, useTheme, useThemedStyles } from '../context/ThemeContext';
import Toolbar from '../components/Toolbar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const { signIn, error } = useAuth();
  const { t } = useLanguage();
  const { colors, dark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lock = useRef(false);

  async function handleSubmit() {
    if (lock.current) return;
    lock.current = true;
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } finally {
      lock.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <Toolbar />
      <View style={styles.topRow}><Image accessibilityLabel="Perseverance Technology Indonesia logo" source={require('../../assets/Perseverance Technology Logo.png')} style={[styles.brandLogo, { tintColor: dark ? colors.onPrimary : colors.primary }]} /></View>
      <Text style={styles.eyebrow}>{t('loginEyebrow')}</Text>
      <Text style={styles.title}>{t('welcomeBack')}</Text>
      <Text style={styles.subtitle}>{t('loginSubtitle')}</Text>

      <View style={styles.form}>
        <Text style={styles.label}>{t('employeeEmail')}</Text>
        <TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} style={styles.input} value={email} placeholder="Email perusahaan" placeholderTextColor={colors.muted} />
        <Text style={styles.label}>{t('password')}</Text>
        <TextInput autoCapitalize="none" onChangeText={setPassword} secureTextEntry style={styles.input} value={password} placeholder={t('passwordPlaceholder')} placeholderTextColor={colors.muted} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={handleSubmit} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t('login')}</Text>}
        </Pressable>
      </View>
      <Text style={styles.footer}>{t('loginApiFooter')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, width: '100%', maxWidth: 520, alignSelf: 'center' },
  topRow: { minHeight: 132, justifyContent: 'center', alignItems: 'center', position: 'relative', marginBottom: spacing.md },
  brandLogo: { width: 180, height: 140, resizeMode: 'contain' },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: '800', marginTop: spacing.sm },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: spacing.sm, maxWidth: 330 },
  form: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 24, padding: spacing.lg, marginTop: spacing.xl, ...shadow },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.ink, fontSize: 15, paddingHorizontal: spacing.md, paddingVertical: 13 },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  button: { backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', minHeight: 50, justifyContent: 'center', marginTop: spacing.lg },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  footer: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing.xl },
  languagePicker: { position: 'absolute', right: 0, top: 0, flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 2, backgroundColor: colors.surface },
  languageOption: { minWidth: 30, minHeight: 25, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  languageActive: { backgroundColor: colors.primary },
  languageText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  languageActiveText: { color: '#FFFFFF' },
});
