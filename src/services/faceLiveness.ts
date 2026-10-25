// Pure liveness / auto-capture state machine shared by enrollment (and attendance, issue #3).
// It only consumes normalized observations, so it is unit-testable and independent of the camera library.
import type { EnrollmentPose } from './faceCapture';

export type FaceObservation = {
  /** Face rectangle normalized to the preview (0..1), already in on-screen (mirrored) coordinates. */
  box: { x: number; y: number; width: number; height: number };
  /** Degrees, raw detector values. Sign differs per platform/mirroring: calibrate with livenessConfig.leftYawSign. */
  yaw: number; pitch: number; roll: number;
  /** 0..1, null when the detector cannot classify. */
  leftEyeOpen: number | null; rightEyeOpen: number | null;
};

export type LivenessHint =
  | 'noFace' | 'multipleFaces' | 'moveCloser' | 'moveBack' | 'centerFace' | 'lookStraight' | 'tiltHead'
  | 'turnLeft' | 'turnRight' | 'blink' | 'holdStill';
export type LivenessPhase = 'positioning' | 'blink' | 'hold' | 'captured' | 'timeout';
export type LivenessUpdate = { phase: LivenessPhase; hint: LivenessHint; ready: boolean; capture: boolean };

export const livenessConfig = {
  minWidth: 0.32, maxWidth: 0.8,            // face width as a share of the preview width
  centerTolerance: { x: 0.18, y: 0.2 },     // allowed distance of face center from preview center
  frontYaw: 12, turnYawMin: 18, turnYawMax: 45, maxPitch: 18, maxRoll: 20,
  eyeOpen: 0.6, eyeClosed: 0.25,
  holdFrames: 6,                            // ~0.4 s at 15 fps of a stable, in-pose, eyes-open face
  timeoutMs: 20000,
  // Device-dependent: with a mirrored front-camera preview ML Kit's yaw sign may be flipped. Verify on device
  // against face-demo-app and flip this constant (1 / -1) if "left" and "right" are swapped.
  leftYawSign: -1,
} as const;

export type LivenessMachine = { update: (faces: FaceObservation[], nowMs?: number) => LivenessUpdate; reset: () => void };

export function createLivenessMachine(pose: EnrollmentPose, clock: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), config = livenessConfig): LivenessMachine {
  let startedAt: number | null = null; let blinkStage: 'open' | 'closed' | 'done' = 'open'; let stable = 0; let captured = false; let timedOut = false;
  const reset = () => { startedAt = null; blinkStage = 'open'; stable = 0; captured = false; timedOut = false; };
  const result = (phase: LivenessPhase, hint: LivenessHint, ready = false, capture = false): LivenessUpdate => ({ phase, hint, ready, capture });

  function poseHint(face: FaceObservation): LivenessHint | null {
    const { box } = face;
    if (box.width < config.minWidth) return 'moveCloser';
    if (box.width > config.maxWidth) return 'moveBack';
    if (Math.abs(box.x + box.width / 2 - 0.5) > config.centerTolerance.x || Math.abs(box.y + box.height / 2 - 0.45) > config.centerTolerance.y) return 'centerFace';
    if (Math.abs(face.pitch) > config.maxPitch || Math.abs(face.roll) > config.maxRoll) return 'tiltHead';
    if (pose === 'front') return Math.abs(face.yaw) > config.frontYaw ? 'lookStraight' : null;
    const towardLeft = face.yaw * config.leftYawSign; // > 0 means turned toward the user's left
    const turned = pose === 'left' ? towardLeft : -towardLeft;
    if (turned < config.turnYawMin) return pose === 'left' ? 'turnLeft' : 'turnRight';
    if (turned > config.turnYawMax) return pose === 'left' ? 'turnRight' : 'turnLeft';
    return null;
  }

  function update(faces: FaceObservation[], nowMs = clock()): LivenessUpdate {
    if (captured) return result('captured', 'holdStill', true);
    if (startedAt === null) startedAt = nowMs;
    if (timedOut || nowMs - startedAt > config.timeoutMs) { timedOut = true; return result('timeout', 'noFace'); }
    if (faces.length === 0) { stable = 0; return result('positioning', 'noFace'); }
    if (faces.length > 1) { stable = 0; return result('positioning', 'multipleFaces'); }
    const face = faces[0];
    const hint = poseHint(face);
    if (hint) { stable = 0; return result('positioning', hint); }
    const left = face.leftEyeOpen; const right = face.rightEyeOpen;
    if (left === null || right === null) { stable = 0; return result('blink', 'blink', true); }
    const open = Math.min(left, right) >= config.eyeOpen; const closed = Math.max(left, right) <= config.eyeClosed;
    if (blinkStage !== 'done') {
      // Liveness: eyes must be seen open, then closed, then open again while the pose is held.
      if (blinkStage === 'open' && closed) blinkStage = 'closed';
      else if (blinkStage === 'closed' && open) { blinkStage = 'done'; stable = 0; return result('hold', 'holdStill', true); }
      stable = 0; return result('blink', 'blink', true);
    }
    if (!open) { stable = 0; return result('hold', 'holdStill', true); }
    stable += 1;
    if (stable >= config.holdFrames) { captured = true; return result('captured', 'holdStill', true, true); }
    return result('hold', 'holdStill', true);
  }
  return { update, reset };
}
