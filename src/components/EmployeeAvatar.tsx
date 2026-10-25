import { useEffect, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { photoBytesDataUri } from '../services/photoDataUri';
import { getAccessToken } from '../services/tokenStorage';
export default function EmployeeAvatar({ size = 88 }: { size?: number }) {
  const { employee } = useAuth(); const { data } = useData(); const { colors } = useTheme();
  const profile = data?.employee ?? employee;
  const [token, setToken] = useState<string | null>(null); const [failed, setFailed] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  useEffect(() => { let active = true; void getAccessToken().then((value) => { if (active) setToken(value); }).catch(() => {}); return () => { active = false; }; }, [employee?.id]);
  useEffect(() => { setFailed(false); }, [profile?.photo_version]);
  useEffect(() => {
    if (!profile?.photo_url || !token) return;
    const controller = new AbortController(); let objectUrl: string | null = null;
    setImageUri(null); setFailed(false);
    const timer = setTimeout(() => controller.abort(), 15000);
    void api.getBinary(profile.photo_url, 5 * 1024 * 1024, controller.signal).then(({ bytes, contentType }) => {
      if (!/^image\/(jpeg|png|webp)(;|$)/i.test(contentType)) throw new Error('Invalid photo');
      if (Platform.OS === 'web') {
        const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: contentType }); if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob); setImageUri(objectUrl);
      } else {
        // Load protected bytes through the same authenticated fetch as the API.
        // Avoid differences in native Image networking/header handling.
        const uri = photoBytesDataUri(bytes, contentType);
        if (!controller.signal.aborted) setImageUri(uri);
      }
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); }).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [profile?.photo_url, profile?.photo_version, token]);
  if (profile?.photo_url && token && !failed && imageUri) return <Image accessibilityLabel={profile.name} source={{ uri: imageUri }} style={{ width: size, height: size, borderRadius: size / 2 }} onError={() => setFailed(true)} />;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.accent, fontSize: size / 3, fontWeight: '800' }}>{profile?.name.charAt(0) ?? 'A'}</Text></View>;
}
