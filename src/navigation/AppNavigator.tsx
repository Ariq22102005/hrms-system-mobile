import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef, DarkTheme, DefaultTheme, NavigationContainer, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import AttendanceScreen from '../screens/AttendanceScreen';
import FaceEnrollmentScreen from '../screens/FaceEnrollmentScreen';
import HomeScreen from '../screens/HomeScreen';
import LeaveScreen from '../screens/LeaveScreen';
import LoginScreen from '../screens/LoginScreen';
import OvertimeScreen from '../screens/OvertimeScreen';
import PayrollScreen from '../screens/PayrollScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useFaceEnrollmentPush } from './useFaceEnrollmentPush';
export type FaceEnrollmentReturn = 'Home' | 'Attendance' | 'Profile';
export type EmployeeTabParamList = { Home: undefined; Leave: undefined; Attendance: undefined; Payroll: undefined; Overtime: undefined; Profile: undefined; FaceEnrollment: { returnTo?: FaceEnrollmentReturn } | undefined };
// Profile and FaceEnrollment are hidden routes: no tab button, no swipe. Profile opens from the Home name card (or the toolbar avatar on other pages); FaceEnrollment is full-screen and hides the tab bar.
const order = ['Home', 'Leave', 'Attendance', 'Payroll', 'Overtime'] as const;
type SwipeRoute = (typeof order)[number] | 'Profile';
const navigationRef = createNavigationContainerRef<EmployeeTabParamList>();
const icons = { Home: 'home-outline', Leave: 'calendar-outline', Attendance: 'finger-print', Payroll: 'wallet-outline', Overtime: 'time-outline' } as const;
const Tab = createBottomTabNavigator<EmployeeTabParamList>();
function SwipePages({ children, route }: { children: ReactNode; route: SwipeRoute }) {
  const navigation = useNavigation();
  const navRef = useRef(navigation); navRef.current = navigation;
  const current = useRef<keyof EmployeeTabParamList>(route); current.current = route;
  const pan = useRef(PanResponder.create({
    // The attendance map owns horizontal gestures; tabs remain available below.
    onMoveShouldSetPanResponder: (_, g) => current.current !== 'Attendance' && current.current !== 'Profile' && Math.abs(g.dx) > 35 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) < 75 || Math.abs(g.dx) < Math.abs(g.dy) * 2) return;
      const position = (order as readonly string[]).indexOf(current.current);
      const index = position + (g.dx < 0 ? 1 : -1);
      if (position >= 0 && order[index]) navRef.current.navigate(order[index] as never);
    },
  })).current;
  return <View style={{ flex: 1 }} {...pan.panHandlers}>{children}</View>;
}
function Navbar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme(); const { t } = useLanguage(); const insets = useSafeAreaInsets();
  if (state.routes[state.index]?.name === 'FaceEnrollment') return null;
  const labels = { Home: 'Home', Leave: t('leaveTab'), Attendance: t('attendance'), Payroll: t('payroll'), Overtime: t('overtime') };
  return <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 8 }}>
    {state.routes.filter((route) => route.name !== 'Profile' && route.name !== 'FaceEnrollment').map((route) => {
      const name = route.name as (typeof order)[number]; const center = name === 'Attendance'; const selected = state.routes[state.index]?.key === route.key;
      return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={labels[name]} accessibilityState={{ selected }} aria-selected={selected} onPress={() => { const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!selected && !event.defaultPrevented) navigation.navigate(route.name); }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })} style={{ flex: 1, alignItems: 'center', minHeight: 54, justifyContent: 'center' }}>
        <View style={center ? { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: -30, borderWidth: 5, borderColor: colors.background } : { paddingBottom: 4 }}><Ionicons name={icons[name]} size={center ? 32 : 25} color={center ? '#FFFFFF' : selected ? colors.accent : colors.muted} /></View>
        <Text numberOfLines={1} style={{ color: selected ? colors.accent : colors.muted, fontSize: 10, fontWeight: selected ? '800' : '600', marginTop: center ? 2 : 0 }}>{labels[name]}</Text>
      </Pressable>;
    })}
  </View>;
}
function FaceEnrollmentPushBridge({ ready }: { ready: boolean }) { useFaceEnrollmentPush(navigationRef, ready); return null; }
export default function AppNavigator() {
  const { employee, isLoading } = useAuth(); const { colors, dark } = useTheme();
  const [navReady, setNavReady] = useState(false);
  useEffect(() => { if (!employee) setNavReady(false); }, [employee]);
  if (isLoading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.accent} /></View>;
  if (!employee) return <LoginScreen />;
  const theme = dark ? DarkTheme : DefaultTheme;
  return <NavigationContainer ref={navigationRef} onReady={() => setNavReady(true)} theme={{ ...theme, colors: { ...theme.colors, background: colors.background, card: colors.surface, text: colors.ink, border: colors.border, primary: colors.primary } }}>
    <FaceEnrollmentPushBridge ready={navReady} />
    <Tab.Navigator initialRouteName="Home" backBehavior="history" tabBar={(props) => <Navbar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background }, lazy: true }}>
      <Tab.Screen name="Home">{() => <SwipePages route="Home"><HomeScreen /></SwipePages>}</Tab.Screen>
      <Tab.Screen name="Leave">{() => <SwipePages route="Leave"><LeaveScreen /></SwipePages>}</Tab.Screen>
      <Tab.Screen name="Attendance">{() => <SwipePages route="Attendance"><AttendanceScreen /></SwipePages>}</Tab.Screen>
      <Tab.Screen name="Payroll">{() => <SwipePages route="Payroll"><PayrollScreen /></SwipePages>}</Tab.Screen>
      <Tab.Screen name="Overtime">{() => <SwipePages route="Overtime"><OvertimeScreen /></SwipePages>}</Tab.Screen>
      <Tab.Screen name="Profile">{() => <SwipePages route="Profile"><ProfileScreen /></SwipePages>}</Tab.Screen>
      <Tab.Screen name="FaceEnrollment" component={FaceEnrollmentScreen} />
    </Tab.Navigator>
  </NavigationContainer>;
}
