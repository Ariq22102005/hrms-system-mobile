import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { DataProvider } from './src/context/DataContext';
import { FaceStatusProvider } from './src/context/FaceStatusContext';

function ThemedApp() {
  const { dark } = useTheme();
  return <><StatusBar style={dark ? 'light' : 'dark'} /><AppNavigator /></>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider><AuthProvider><DataProvider><FaceStatusProvider><ThemedApp /></FaceStatusProvider></DataProvider></AuthProvider></ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
