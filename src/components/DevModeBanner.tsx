import React from 'react';
import { View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import Text from './AppText';

const IS_DEV = Constants.expoConfig?.extra?.isDev === true;

// Only rendering that distinguishes the Dev build/site from Production once
// you're actually inside the app — app name and icon are only visible
// before opening it. See app.config.js `extra.isDev`.
export default function DevModeBanner() {
  if (!IS_DEV) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>⚠ DEV MODE — δοκιμαστική βάση, όχι παραγωγή ⚠</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#D32F2F',
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
