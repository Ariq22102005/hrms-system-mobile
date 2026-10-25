import { Text, View } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import type { FaceLivenessCameraProps } from './faceLivenessCameraTypes';
// VisionCamera has no web build; web only runs the mock/browser tests and never enrolls faces.
export default function FaceLivenessCamera(_: FaceLivenessCameraProps) {
  const { t } = useLanguage();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#000000' }}><Text style={{ color: '#FFFFFF', textAlign: 'center' }}>{t('feWebUnsupported')}</Text></View>;
}
