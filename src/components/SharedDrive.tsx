import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { api, ApiError, FileDto } from '../services/api';
import { saveSharedFile } from '../services/sharedFiles';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export default function SharedDrive() {
  const { colors } = useTheme(); const { t } = useLanguage();
  const [visible, setVisible] = useState(false); const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileDto[]>([]); const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); const lock = useRef(false); const active = useRef(true);
  useEffect(() => () => { active.current = false; }, []);
  useEffect(() => {
    if (!visible) return;
    let current = true; setLoading(true); setError(null);
    void api.getFiles().then((rows) => { if (current) setFiles(rows); }).catch((e) => { if (current) setError(e instanceof ApiError && e.status === 404 ? t('filesUnavailable') : e instanceof Error ? e.message : t('loadError')); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [visible, t]);
  async function save(file: FileDto) {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError(null);
    try { await saveSharedFile(file); } catch (e) { if (active.current) setError(e instanceof Error ? e.message : t('saveError')); }
    finally { lock.current = false; if (active.current) setSaving(false); }
  }
  const button = { minHeight: 48, padding: 16, borderRadius: 12, backgroundColor: colors.primarySoft, marginTop: 12 };
  return <>
    <Pressable accessibilityRole="button" onPress={() => setVisible(true)} style={button}><Text style={{ color: colors.accent, fontWeight: '800' }}>{t('sharedDrive')}</Text></Pressable>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#00000088' }}><View accessibilityViewIsModal style={{ padding: 20, backgroundColor: colors.surface, borderRadius: 20, maxHeight: '85%', maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 22, fontWeight: '800' }}>{t('sharedDrive')}</Text>
        {loading || saving ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, marginTop: 12 }}>{error}</Text> : null}
        <ScrollView>{!loading && !error && !files.length ? <Text style={{ color: colors.muted, marginTop: 16 }}>{t('filesEmpty')}</Text> : files.map((file) => <Pressable accessibilityRole="button" accessibilityLabel={`${t('fileDownload')}: ${file.name}`} disabled={saving} key={file.id} onPress={() => void save(file)} style={button}><Text style={{ color: colors.ink }}>{file.name}</Text></Pressable>)}</ScrollView>
        <Pressable accessibilityRole="button" onPress={() => setVisible(false)} style={button}><Text style={{ color: colors.ink }}>{t('close')}</Text></Pressable>
      </View></View>
    </Modal>
  </>;
}
