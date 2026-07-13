import { Alert, Platform } from 'react-native';

/**
 * Cross-platform stand-in for React Native's `Alert.alert`.
 * react-native-web's Alert.alert() is a no-op, so on native platforms this
 * defers to the real thing, and on web it falls back to window.alert/confirm
 * so the auth screens (which run on web via react-native-web) still surface
 * validation/error/success feedback to the user.
 */
export function alert(
  title: string,
  message?: string,
  buttons?: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = [title, message].filter(Boolean).join('\n\n');

  if (buttons && buttons.length > 1) {
    const cancelBtn = buttons.find(b => b.style === 'cancel');
    const confirmBtn = buttons.find(b => b !== cancelBtn) ?? buttons[0];
    if (window.confirm(text)) confirmBtn?.onPress?.();
    else cancelBtn?.onPress?.();
    return;
  }

  window.alert(text);
  buttons?.[0]?.onPress?.();
}
