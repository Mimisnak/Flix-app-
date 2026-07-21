import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Same native-vs-web split already used for the Supabase auth session
// storage in src/lib/supabase.ts — AsyncStorage isn't used on web there
// either, so simple preferences follow the same convention here.
export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
};
