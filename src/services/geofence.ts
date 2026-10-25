import type { LocationSample, OfficeDto } from './api';
import { officeDistance } from './officeLocation';
import { leafletCss, leafletJs } from '../generated/mapAssets';

export function geofencePreview(sample: LocationSample | null, office: OfficeDto, now: number) {
  if (!sample) return { status: 'unavailable' as const, distance: null };
  const distance = officeDistance(sample, office);
  if (!Number.isFinite(sample.latitude) || Math.abs(sample.latitude) > 90 || !Number.isFinite(sample.longitude) || Math.abs(sample.longitude) > 180
    || sample.mocked || !Number.isFinite(sample.timestamp) || now - sample.timestamp > 45000 || sample.timestamp > now + 5000
    || sample.accuracy == null || !Number.isFinite(sample.accuracy) || sample.accuracy <= 0 || sample.accuracy > office.max_accuracy_meters) {
    return { status: 'unreliable' as const, distance: Number.isFinite(distance) ? distance : null };
  }
  return { status: distance <= office.radius_meters ? 'inside' as const : 'outside' as const, distance };
}

// Only numeric coordinates enter the document. No credentials or API responses
// are passed to the map. Final attendance eligibility is decided by the API.
export function geofenceMapHtml(office: OfficeDto, sample: LocationSample | null) {
  const point = sample && Number.isFinite(sample.latitude) && Math.abs(sample.latitude) <= 90 && Number.isFinite(sample.longitude) && Math.abs(sample.longitude) <= 180
    ? [sample.latitude, sample.longitude] : null;
  const settings = JSON.stringify({ center: [office.latitude, office.longitude], radius: office.radius_meters, point });
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin">
<style>${leafletCss}</style>
<style>html,body,#map{height:100%;margin:0;background:#F5F2ED;font:13px system-ui}#hint{position:absolute;z-index:800;bottom:24px;left:8px;right:8px;background:#F5F2ED;padding:8px;border-radius:8px;color:#0B0B0B}</style></head><body><div id="map"></div><div id="hint">Peta membutuhkan internet / Map requires internet</div>
<script>${leafletJs}</script>
<script>if(window.L){const c=${settings};const map=L.map('map',{scrollWheelZoom:false});const area=L.circle(c.center,{radius:c.radius,color:'#8B0D1A',fillColor:'#8B0D1A',fillOpacity:.12,dashArray:'6 6'}).addTo(map);L.circleMarker(c.center,{radius:5,color:'#8B0D1A',fillOpacity:1}).addTo(map);let bounds=area.getBounds();if(c.point){L.circleMarker(c.point,{radius:8,color:'#FFFFFF',weight:3,fillColor:'#236349',fillOpacity:1}).addTo(map);bounds.extend(c.point);}map.fitBounds(bounds,{padding:[28,28],maxZoom:18});const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);tiles.on('tileload',()=>document.getElementById('hint').hidden=true);tiles.on('tileerror',()=>document.getElementById('hint').hidden=false);}</script></body></html>`;
}
