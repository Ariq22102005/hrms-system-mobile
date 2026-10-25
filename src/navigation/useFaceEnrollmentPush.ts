import { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useFaceStatus } from '../context/FaceStatusContext';
import { claimNotificationOnce, isFaceEnrollmentPush } from '../services/pushRouting';
import type { EmployeeTabParamList } from './AppNavigator';

/**
 * Handles pushes with data.screen === 'FaceEnrollment':
 *  - tapped from background / cold start -> open the enrollment status screen and refresh the status
 *  - received while the app is open      -> only refresh the status (no forced navigation)
 * Token registration and the foreground notification handler belong to issue #4.
 * Mount this only while an employee is signed in, so a cold-start tap is handled right after login.
 */
export function useFaceEnrollmentPush(navigation: NavigationContainerRefWithCurrent<EmployeeTabParamList>, ready: boolean) {
  const { refresh } = useFaceStatus();
  useEffect(() => {
    if (Platform.OS === 'web' || !ready) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response || !isFaceEnrollmentPush(response.notification.request.content.data)) return;
      if (!claimNotificationOnce(response.notification.request.identifier)) return;
      void refresh();
      if (navigation.isReady()) navigation.navigate('FaceEnrollment', { returnTo: 'Home' });
    };
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    const received = Notifications.addNotificationReceivedListener((n) => { if (isFaceEnrollmentPush(n.request.content.data)) void refresh(); });
    return () => { tapped.remove(); received.remove(); };
  }, [navigation, ready, refresh]);
}
