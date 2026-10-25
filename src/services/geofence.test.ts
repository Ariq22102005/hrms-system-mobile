import { describe, expect, it } from 'vitest';
import { geofenceMapHtml, geofencePreview } from './geofence';
import type { LocationSample, OfficeDto } from './api';

const office: OfficeDto = { latitude: -3.8, longitude: 102.2, radius_meters: 100, max_accuracy_meters: 30, time_zone: 'Asia/Jakarta' };
const now = 1800000000000;
const sample: LocationSample = { latitude: -3.8, longitude: 102.2, accuracy: 5, timestamp: now, mocked: false };
describe('server-configured geofence preview', () => {
  it('uses the server radius and measures distance in meters', () => {
    expect(geofencePreview(sample, office, now)).toEqual({ status: 'inside', distance: 0 });
    const moved = { ...sample, latitude: sample.latitude + 0.001 };
    expect(geofencePreview(moved, office, now).status).toBe('outside');
    expect(geofencePreview(moved, { ...office, radius_meters: 200 }, now).status).toBe('inside');
    expect(geofencePreview(moved, office, now).distance).toBeCloseTo(111.19, 1);
  });
  it.each([{ accuracy: null }, { accuracy: 0 }, { accuracy: 31 }, { mocked: true }, { timestamp: now - 45001 }, { timestamp: now + 5001 }, { latitude: NaN }, { longitude: 190 }])('never reports invalid GPS as inside: %j', (override) => {
    expect(geofencePreview({ ...sample, ...override }, office, now).status).toBe('unreliable');
  });
  it('requires a sample and accepts the exact accuracy limit', () => {
    expect(geofencePreview(null, office, now).status).toBe('unavailable');
    expect(geofencePreview({ ...sample, accuracy: 30 }, office, now).status).toBe('inside');
  });
  it('draws server geometry without injecting unrelated API fields or invalid coordinates', () => {
    const html = geofenceMapHtml({ ...office, name: '</script>evil' } as OfficeDto, { ...sample, latitude: NaN });
    expect(html).toContain('"radius":100'); expect(html).toContain('"point":null');
    expect(html).not.toContain('evil'); expect(html).toContain('OpenStreetMap');
  });
});
