import type { EnrollmentPose } from '../services/faceCapture';
export type CapturedFacePhoto = { base64: string; capturedAt: string };
export type FaceLivenessCameraProps = {
  pose: EnrollmentPose;
  /** Camera is only live while true (screen focused, app in foreground, a pose is being captured). */
  active: boolean;
  /** Fired at most once per mount, after liveness + pose hold are satisfied. The temp file is already deleted. Remount (key) to capture another pose. */
  onCaptured: (photo: CapturedFacePhoto) => void;
  onError: (message: string, kind?: 'permission' | 'camera' | 'capture') => void;
};
