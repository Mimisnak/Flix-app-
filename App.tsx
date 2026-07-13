import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';

const NAV_THEME = {
  dark: true,
  colors: {
    primary: '#3A9EFB',
    background: '#0D0D0F',
    card: '#1A1A2E',
    text: '#FFFFFF',
    border: '#2A2A3E',
    notification: '#3A9EFB',
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '900' as const },
  },
};

export default function App() {
  return (
    <NavigationContainer theme={NAV_THEME}>
      <AppNavigator />
    </NavigationContainer>
  );
}
