import { WebView } from 'react-native-webview';
import { Linking } from 'react-native';

export default function GeofenceMap({ html }: { html: string }) {
  return <WebView source={{ html, baseUrl: 'https://github.com/LohaHola/Aranus-Attendance' }} style={{ height: 250, flex: 0 }}
    originWhitelist={['https://*', 'about:blank']} javaScriptEnabled domStorageEnabled={false}
    sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} allowFileAccess={false} mixedContentMode="never"
    applicationNameForUserAgent="PTIAttendance/1.0.0" setSupportMultipleWindows={false}
    onShouldStartLoadWithRequest={(request) => {
      if (request.url === 'https://www.openstreetmap.org/copyright') { void Linking.openURL(request.url).catch(() => {}); return false; }
      return request.url === 'about:blank' || request.url === 'https://github.com/LohaHola/Aranus-Attendance/' || request.url === 'https://github.com/LohaHola/Aranus-Attendance';
    }} />;
}
