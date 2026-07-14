import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Captured BEFORE createClient() runs. With detectSessionInUrl on, the
// client asynchronously parses (and then strips) the recovery tokens out
// of the URL as part of its own init — any check for them done later, even
// in a React effect on first mount, can lose that race and find the hash
// already empty. Reading it here, at module-evaluation time, is the only
// point guaranteed to run before that async processing starts.
export const isPasswordRecoveryLink =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  (window.location.hash.includes('type=recovery') || window.location.search.includes('code='));

// On native there's no localStorage, so the session was never persisted across
// app restarts unless AsyncStorage is wired up explicitly. On web we keep the
// default (localStorage) so it doesn't conflict with our own remember-me flag.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
