import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useFontScale } from '../lib/fontScale';

// Drop-in replacement for RN's Text. Every screen imports this AS `Text`
// (e.g. `import Text from '../../components/AppText'`), so the global
// font-size setting (src/lib/fontScale.tsx) applies everywhere with zero
// JSX changes — just one swapped import per file. Only scales elements
// that already declare an explicit fontSize, so anything relying on the
// platform default is left untouched.
export default function AppText({ style, ...props }: TextProps) {
  const { scale } = useFontScale();
  const flat = StyleSheet.flatten(style);
  if (typeof flat?.fontSize !== 'number' || scale === 1) {
    return <Text {...props} style={style} />;
  }
  return <Text {...props} style={[style, { fontSize: flat.fontSize * scale }]} />;
}
