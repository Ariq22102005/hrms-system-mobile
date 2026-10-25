export default function GeofenceMap({ html }: { html: string }) {
  return <iframe title="Office geofence map" srcDoc={html} sandbox="allow-scripts" referrerPolicy="strict-origin-when-cross-origin" style={{ width: '100%', height: 250, border: 0 }} />;
}
