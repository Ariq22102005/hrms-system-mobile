import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ComponentType, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import type { FaceLivenessCameraProps } from './faceLivenessCameraTypes';

// VisionCamera and the ML Kit face detector are native modules. They are not part of Expo Go, and importing
// them at startup crashes the whole app there. This loader imports the real camera only when the enrollment
// camera is shown, and shows a clear message instead of crashing when the native modules are missing.
export default function FaceLivenessCameraLoader(props: FaceLivenessCameraProps) {
  const { t } = useLanguage();
  const [Camera, setCamera] = useState<ComponentType<FaceLivenessCameraProps> | null>(null);
  const [unavailable, setUnavailable] = useState(Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
  const { onError } = props;

  useEffect(() => {
    if (unavailable) { onError(t('feNeedsDevBuild'), 'camera'); return; }
    let alive = true;
    import('./FaceLivenessCamera')
      .then((module) => { if (alive) setCamera(() => module.default); })
      .catch(() => { if (alive) setUnavailable(true); });
    return () => { alive = false; };
  }, [unavailable, onError, t]);

  if (unavailable) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#000000' }}><Text accessibilityRole="alert" style={{ color: '#FFFFFF', textAlign: 'center', lineHeight: 22 }}>{t('feNeedsDevBuild')}</Text></View>;
  if (!Camera) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' }}><ActivityIndicator color="#FFFFFF" /></View>;
  return <Camera {...props} />;
}
