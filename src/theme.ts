import { Platform } from 'react-native';

export const colors = {
  background: '#F5F2ED',
  surface: '#FFFDFA',
  ink: '#0B0B0B',
  muted: '#68625E',
  border: '#DDD6CF',
  primary: '#8B0D1A',
  accent: '#8B0D1A',
  primarySoft: '#F3E3E4',
  success: '#236349',
  successSoft: '#E4EFE7',
  danger: '#A52332',
  dangerSoft: '#F7E5E6',
  warning: '#805413',
  warningSoft: '#F6ECD8',
  onPrimary: '#F5F2ED',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const shadow = Platform.select({
  ios: {
    shadowColor: '#0B0B0B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  android: { elevation: 2 },
  default: {},
});
