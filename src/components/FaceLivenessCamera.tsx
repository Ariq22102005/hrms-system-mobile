// Shared front-camera component: single-face detection, proportional framing, blink liveness and auto-capture.
// Native only (VisionCamera + ML Kit face detector via react-native-vision-camera-face-detector); see FaceLivenessCamera.web.tsx.
// Needs a development/EAS build, not Expo Go. Mirrors the face-demo-app CaptureScreen setup.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera as VisionCamera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
import { Camera, Face, FrameFaceDetectionOptions } from 'react-native-vision-camera-face-detector';
import { useLanguage } from '../context/LanguageContext';
import { consumeCapturedPhoto } from '../services/faceCapture';
import { createLivenessMachine, FaceObservation, LivenessHint, LivenessUpdate } from '../services/faceLiveness';
import type { FaceLivenessCameraProps } from './faceLivenessCameraTypes';

const hintKeys: Record<LivenessHint, string> = {
  noFace: 'feHintNoFace', multipleFaces: 'feHintMultiple', moveCloser: 'feHintCloser', moveBack: 'feHintBack', centerFace: 'feHintCenter', lookStraight: 'feHintStraight',
  tiltHead: 'feHintTilt', turnLeft: 'feHintLeft', turnRight: 'feHintRight', blink: 'feHintBlink', holdStill: 'feHintHold',
};
const initial: LivenessUpdate = { phase: 'positioning', hint: 'noFace', ready: false, capture: false };
const detectionOptions: FrameFaceDetectionOptions = { cameraFacing: 'front', performanceMode: 'fast', classificationMode: 'all', landmarkMode: 'none', contourMode: 'none', trackingEnabled: false, minFaceSize: 0.2, autoMode: true };
const minFrameIntervalMs = 66; // ~15 fps, as in the #3 requirements

export default function FaceLivenessCamera({ pose, active, onCaptured, onError }: FaceLivenessCameraProps) {
  const { t } = useLanguage();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  // ~1280x720 keeps each JPEG well under the 2 MiB limit enforced by makeFaceCapture().
  const format = useCameraFormat(device, [{ photoResolution: { width: 1280, height: 720 } }]);
  const camera = useRef<VisionCamera>(null);
  const machine = useRef(createLivenessMachine(pose));
  const capturing = useRef(false); const lastFrame = useRef(0); const lastKey = useRef('');
  const [state, setState] = useState<LivenessUpdate>(initial);
  const [view, setView] = useState({ width: 1, height: 1 });
  const [denied, setDenied] = useState(false);
  const callbacks = useRef({ onCaptured, onError }); callbacks.current = { onCaptured, onError };

  useEffect(() => {
    if (hasPermission) return;
    let alive = true;
    void requestPermission().then((granted) => { if (alive && !granted) { setDenied(true); callbacks.current.onError(t('feCameraPermission'), 'permission'); } });
    return () => { alive = false; };
  }, [hasPermission, requestPermission, t]);

  const restart = useCallback(() => { machine.current = createLivenessMachine(pose); capturing.current = false; lastKey.current = ''; setState(initial); }, [pose]);

  const capture = useCallback(async () => {
    if (capturing.current || !camera.current) return;
    capturing.current = true;
    try {
      const photo = await camera.current.takePhoto({ flash: 'off', enableShutterSound: false });
      const base64 = await consumeCapturedPhoto(photo.path);
      callbacks.current.onCaptured({ base64, capturedAt: new Date().toISOString() });
    } catch (e) {
      capturing.current = false; machine.current.reset();
      callbacks.current.onError(e instanceof Error ? e.message : t('feCameraUnavailable'), 'capture');
    }
  }, [t]);

  const onFaces = useCallback((faces: Face[]) => {
    const now = Date.now();
    if (now - lastFrame.current < minFrameIntervalMs || capturing.current) return;
    lastFrame.current = now;
    const observed: FaceObservation[] = faces.map((f) => ({
      box: { x: f.bounds.x / view.width, y: f.bounds.y / view.height, width: f.bounds.width / view.width, height: f.bounds.height / view.height },
      yaw: f.yawAngle, pitch: f.pitchAngle, roll: f.rollAngle,
      leftEyeOpen: Number.isFinite(f.leftEyeOpenProbability) ? f.leftEyeOpenProbability : null,
      rightEyeOpen: Number.isFinite(f.rightEyeOpenProbability) ? f.rightEyeOpenProbability : null,
    }));
    const next = machine.current.update(observed);
    // Re-render only when the visible feedback changes (UI refresh ~200 ms at most, not per frame).
    const key = `${next.phase}:${next.hint}`;
    if (key !== lastKey.current) { lastKey.current = key; setState(next); }
    if (next.capture) void capture();
  }, [capture, view.height, view.width]);

  if (denied || (!hasPermission && !device)) {
    return <View style={styles.center}><Text style={styles.text}>{t('feCameraPermission')}</Text><Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.button}><Text style={styles.buttonText}>{t('feOpenSettings')}</Text></Pressable></View>;
  }
  if (!device) return <View style={styles.center}><Text style={styles.text}>{t('feCameraUnavailable')}</Text></View>;

  const good = state.phase === 'blink' || state.phase === 'hold' || state.phase === 'captured';
  return <View style={styles.fill} onLayout={(e) => setView({ width: e.nativeEvent.layout.width || 1, height: e.nativeEvent.layout.height || 1 })}>
    <Camera ref={camera} style={StyleSheet.absoluteFill} device={device} format={format} photo isActive={active && hasPermission}
      faceDetectionCallback={onFaces} faceDetectionOptions={{ ...detectionOptions, windowWidth: view.width, windowHeight: view.height }}
      onError={(e: { message: string }) => callbacks.current.onError(e.message, 'camera')} />
    <View pointerEvents="none" style={[styles.oval, { borderColor: good ? '#4ADE80' : '#FFFFFF' }]} />
    <View pointerEvents="none" style={styles.hintBox}>
      <Text accessibilityLiveRegion="polite" style={styles.hint}>{state.phase === 'timeout' ? t('feTimeout') : t(hintKeys[state.hint])}</Text>
    </View>
    {state.phase === 'timeout' ? <Pressable accessibilityRole="button" onPress={restart} style={[styles.button, styles.retry]}><Text style={styles.buttonText}>{t('feTryAgain')}</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#000000' },
  text: { color: '#FFFFFF', textAlign: 'center', lineHeight: 22 },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8B0D1A', marginTop: 16 },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  retry: { position: "absolute", alignSelf: "center", bottom: 96 },
  oval: { position: 'absolute', top: '10%', left: '14%', width: '72%', height: '52%', borderRadius: 200, borderWidth: 4 },
  hintBox: { position: 'absolute', left: 16, right: 16, bottom: 24, padding: 12, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)' },
  hint: { color: '#FFFFFF', textAlign: 'center', fontWeight: '700', fontSize: 16 },
});
