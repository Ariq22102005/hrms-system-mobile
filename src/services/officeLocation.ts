import type { LocationSample, OfficeDto } from './api';

// Only decides when to ask for confirmation. The API determines the stored
// location status and validates both GPS samples independently.
export function officeDistance(sample: Pick<LocationSample, 'latitude' | 'longitude'>, office: OfficeDto): number {
  const rad = Math.PI / 180;
  const h = Math.sin((office.latitude - sample.latitude) * rad / 2) ** 2 + Math.cos(sample.latitude * rad) * Math.cos(office.latitude * rad) * Math.sin((office.longitude - sample.longitude) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
