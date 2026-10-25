import { describe, expect, it } from 'vitest';
import { createLivenessMachine, FaceObservation } from './faceLiveness';

const face = (over: Partial<FaceObservation> = {}): FaceObservation => ({ box: { x: 0.3, y: 0.2, width: 0.4, height: 0.5 }, yaw: 0, pitch: 0, roll: 0, leftEyeOpen: 0.9, rightEyeOpen: 0.9, ...over });
const closed = (over: Partial<FaceObservation> = {}) => face({ leftEyeOpen: 0.05, rightEyeOpen: 0.05, ...over });

describe('liveness machine', () => {
  it('guides when there is no face, several faces, or a badly placed face', () => {
    const m = createLivenessMachine('front', () => 0);
    expect(m.update([]).hint).toBe('noFace');
    expect(m.update([face(), face()]).hint).toBe('multipleFaces');
    expect(m.update([face({ box: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 } })]).hint).toBe('moveCloser');
    expect(m.update([face({ box: { x: 0.05, y: 0.2, width: 0.4, height: 0.5 } })]).hint).toBe('centerFace');
    expect(m.update([face({ yaw: 30 })]).hint).toBe('lookStraight');
  });
  it('requires a blink and then a stable hold before capturing exactly once', () => {
    const m = createLivenessMachine('front', () => 0);
    for (let i = 0; i < 20; i++) expect(m.update([face()]).capture).toBe(false); // open eyes alone is never enough (photo spoof)
    m.update([closed()]);
    expect(m.update([face()]).phase).toBe('hold');
    let captures = 0;
    for (let i = 0; i < 12; i++) if (m.update([face()]).capture) captures++;
    expect(captures).toBe(1);
  });
  it('resets stability when the face is lost or moves during the hold', () => {
    const m = createLivenessMachine('front', () => 0);
    m.update([closed()]); m.update([face()]);
    for (let i = 0; i < 4; i++) m.update([face()]);
    m.update([face({ yaw: 40 })]);
    for (let i = 0; i < 5; i++) expect(m.update([face()]).capture).toBe(false);
    expect(m.update([face()]).capture).toBe(true);
  });
  it('asks for the right head turn per pose', () => {
    const left = createLivenessMachine('left', () => 0); const right = createLivenessMachine('right', () => 0);
    expect(left.update([face()]).hint).toBe('turnLeft');
    expect(right.update([face()]).hint).toBe('turnRight');
    expect(left.update([face({ yaw: -30 })]).phase).toBe('blink'); // leftYawSign = -1
    expect(right.update([face({ yaw: 30 })]).phase).toBe('blink');
    expect(left.update([face({ yaw: 30 })]).hint).toBe('turnLeft'); // wrong direction
    expect(left.update([face({ yaw: -60 })]).hint).toBe('turnRight'); // overshoot: come back a little
  });
  it('times out and can be reset', () => {
    let now = 0; const m = createLivenessMachine('front', () => now);
    m.update([]); now = 21000;
    expect(m.update([face()]).phase).toBe('timeout');
    m.reset(); now = 22000;
    expect(m.update([face()]).phase).toBe('blink');
  });
});
