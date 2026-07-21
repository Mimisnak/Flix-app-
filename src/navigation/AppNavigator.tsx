import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase, isPasswordRecoveryLink } from '../lib/supabase';
import { registrationGuard } from '../lib/registrationGuard';
import { alert } from '../lib/alert';
import { storage } from '../lib/storage';
import { registerPushToken } from '../lib/notifications';
import { isRememberMeDisabled } from '../lib/rememberMe';
import { useIdleTimeout } from '../lib/useIdleTimeout';
import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import UpdatePasswordScreen from '../screens/UpdatePasswordScreen';
import OwnerNavigator from './OwnerNavigator';
import ShopNavigator from './ShopNavigator';
import DriverNavigator from './DriverNavigator';
import DeveloperNavigator from './DeveloperNavigator';
import NewAnnouncementModal from '../components/NewAnnouncementModal';
// Metro picks WebApp.web.tsx on web and WebApp.tsx (null stub) on native
import WebApp from '../web/WebApp';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

type AppScreen = 'splash' | 'auth' | 'owner' | 'shop' | 'driver' | 'developer' | 'recovery';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const LAST_SEEN_ANNOUNCEMENT_KEY = 'flixfix_last_seen_announcement';

export default function AppNavigator() {
  // isPasswordRecoveryLink is read from the URL at module-load time (see
  // src/lib/supabase.ts) — using it directly as the initial state, rather
  // than detecting it in an effect after mount, means the very first render
  // already shows the recovery screen with no async race to lose.
  const [screen, setScreen] = useState<AppScreen>(isPasswordRecoveryLink ? 'recovery' : 'splash');
  const [authInitialRoute, setAuthInitialRoute] = useState<keyof AuthStackParamList>('Welcome');
  // Shown via NewAnnouncementModal — not marked "seen" (storage write) until
  // the user actually dismisses it, so if the app is killed mid-display it
  // shows again next open rather than being silently missed.
  const [announcement, setAnnouncement] = useState<{ id: string; message: string } | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const currentRoleRef = useRef<AppScreen>('splash');
  // Set as soon as a PASSWORD_RECOVERY session is detected, so the SIGNED_IN
  // branch below doesn't yank the user into their normal dashboard before
  // they've had a chance to set a new password.
  const isRecoveryRef = useRef(isPasswordRecoveryLink);

  // Only shops/drivers carry an "online"/"open" status the owner relies on —
  // auto-signout after inactivity, plus a heartbeat so that status can't get
  // stuck "online" forever if the app dies without a clean sign-out.
  const { resetActivity } = useIdleTimeout(
    screen === 'shop' || screen === 'driver',
    currentUserIdRef.current
  );

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        isRecoveryRef.current = true;
        setScreen('recovery');
        return;
      }
      if (event === 'SIGNED_OUT' || !session) {
        // Set offline before clearing state
        if (currentUserIdRef.current && (currentRoleRef.current === 'driver' || currentRoleRef.current === 'shop')) {
          await supabase.from('users').update({ online_status: false }).eq('id', currentUserIdRef.current);
        }
        currentUserIdRef.current = null;
        isRecoveryRef.current = false;
        setScreen('auth');
      } else if (event === 'SIGNED_IN') {
        if (isRecoveryRef.current) return;
        // signUp() on RegisterScreen fires this same event immediately,
        // racing ahead of its own create_user_profile() RPC call — querying
        // the users table here before that row exists showed a scary
        // "account not found" alert right before Register's own success
        // one. See src/lib/registrationGuard.ts.
        if (registrationGuard.inProgress) return;
        await fetchRoleAndNavigate(session.user.id);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Realtime companion to checkForNewAnnouncement() below — that one only
  // catches up on login/app-open, so anyone already inside the app when the
  // developer posts a new announcement would otherwise not see it until
  // their next login. Only pops it if someone's actually signed in
  // (currentUserIdRef set) — a row inserted while sitting on the login
  // screen shouldn't interrupt that.
  useEffect(() => {
    const channel = supabase
      .channel('app-announcements-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_announcements' },
        (payload) => {
          if (!currentUserIdRef.current) return;
          const row = payload.new as { id: string; message: string };
          setAnnouncement({ id: row.id, message: row.message });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Native deep-link handling for the "forgot password" email link — the
  // flixfix:// link has to be parsed by hand (no browser URL for Supabase
  // to auto-detect on native).
  useEffect(() => {
    if (Platform.OS === 'web') return;

    async function handleIncomingUrl(url: string | null) {
      if (!url || !url.includes('reset-password')) return;

      // PKCE-style link: flixfix://reset-password?code=...
      if (url.includes('code=')) {
        isRecoveryRef.current = true;
        setScreen('recovery');
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) console.warn('Password recovery link failed:', error.message);
        return;
      }

      // Implicit-flow link: flixfix://reset-password#access_token=...&type=recovery
      const hashIndex = url.indexOf('#');
      if (hashIndex === -1) return;
      const params = new URLSearchParams(url.substring(hashIndex + 1));
      if (params.get('type') !== 'recovery') return;
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) return;

      isRecoveryRef.current = true;
      setScreen('recovery');
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) console.warn('Password recovery link failed:', error.message);
    }

    Linking.getInitialURL().then(handleIncomingUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleIncomingUrl(url));
    return () => sub.remove();
  }, []);

  // Deliberately no "set offline when app goes to background" handler here.
  // AppState reports 'background' the instant the screen locks, a
  // notification shade opens, or the user briefly switches apps — none of
  // which mean the driver/shop actually stopped working, but each one
  // flipped online_status to false within seconds, causing the owner's
  // dashboard to flicker between online/offline for someone still on
  // shift. The heartbeat + 2-minute staleness window (src/lib/onlineStatus.ts)
  // already covers "actually walked away" without this false-positive.

  // Called when splash animation finishes — then we check auth
  async function handleSplashFinish() {
    if (isRecoveryRef.current) {
      setScreen('recovery');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setScreen('auth');
      return;
    }
    // "Remember me" was left unchecked at the last login — don't silently
    // resume that session across an app restart, send the user back to Login.
    if (await isRememberMeDisabled()) {
      await supabase.auth.signOut();
      setScreen('auth');
      return;
    }
    await fetchRoleAndNavigate(session.user.id);
  }

  async function fetchRoleAndNavigate(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('role, approved, active')
      .eq('id', userId)
      .single();

    if (!data) {
      alert('Ο λογαριασμός δεν βρέθηκε', 'Αυτό το προφίλ δεν υπάρχει πια. Επικοινώνησε με τον διαχειριστή αν νομίζεις ότι πρόκειται για λάθος.');
      await supabase.auth.signOut();
      return;
    }

    if (!data.approved) {
      alert('Αναμονή', 'Ο λογαριασμός σου αναμένει έγκριση από τον διαχειριστή.');
      await supabase.auth.signOut();
      return;
    }

    if (data.active === false) {
      alert('Λογαριασμός Ανενεργός', 'Ο λογαριασμός σου έχει απενεργοποιηθεί. Επικοινώνησε με τον διαχειριστή.');
      await supabase.auth.signOut();
      return;
    }

    currentUserIdRef.current = userId;
    currentRoleRef.current = data.role as AppScreen;
    setScreen(data.role as AppScreen);
    registerPushToken();
    checkForNewAnnouncement();
  }

  // Pops the newest "Νέα της Εφαρμογής" entry the moment the app opens, once
  // per new announcement per ACCOUNT — keyed by user id, not just device, so
  // two different accounts signed into the same physical device each get
  // their own "have I seen this one" state instead of one dismissing it for
  // everyone on that phone. Works on native and web since this whole
  // component tree renders on both (react-native-web supports Modal). The
  // realtime subscription above covers the case where the app is already
  // open when a new one gets posted; this one covers login/app-open.
  async function checkForNewAnnouncement() {
    const userId = currentUserIdRef.current;
    if (!userId) return;

    const { data } = await supabase
      .from('app_announcements')
      .select('id, message')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return;

    const lastSeenId = await storage.getItem(`${LAST_SEEN_ANNOUNCEMENT_KEY}_${userId}`);
    if (lastSeenId === data.id) return;

    setAnnouncement({ id: data.id, message: data.message });
  }

  function dismissAnnouncement() {
    const userId = currentUserIdRef.current;
    if (announcement && userId) storage.setItem(`${LAST_SEEN_ANNOUNCEMENT_KEY}_${userId}`, announcement.id);
    setAnnouncement(null);
  }

  // Called once the user has set a new password from UpdatePasswordScreen —
  // sign the recovery session out and land back on the Login screen.
  async function handleRecoveryDone() {
    setAuthInitialRoute('Login');
    await supabase.auth.signOut();
  }

  let content: React.ReactNode = null;

  if (screen === 'splash') {
    content = <SplashScreen onFinish={handleSplashFinish} />;
  } else if (screen === 'recovery') {
    content = <UpdatePasswordScreen onDone={handleRecoveryDone} />;
  } else if (screen === 'auth') {
    content = (
      <AuthStack.Navigator initialRouteName={authInitialRoute} screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
        <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </AuthStack.Navigator>
    );
  } else if (screen === 'owner') {
    content = Platform.OS === 'web' ? <WebApp role="owner" /> : <OwnerNavigator />;
  } else if (screen === 'shop') {
    content = Platform.OS === 'web' ? <WebApp role="shop" /> : (
      <View style={{ flex: 1 }} onTouchStart={resetActivity} onTouchMove={resetActivity}>
        <ShopNavigator />
      </View>
    );
  } else if (screen === 'driver') {
    content = Platform.OS === 'web' ? <WebApp role="driver" /> : (
      <View style={{ flex: 1 }} onTouchStart={resetActivity} onTouchMove={resetActivity}>
        <DriverNavigator />
      </View>
    );
  } else if (screen === 'developer') {
    content = Platform.OS === 'web' ? <WebApp role="developer" /> : <DeveloperNavigator />;
  }

  return (
    <>
      {content}
      <NewAnnouncementModal
        visible={!!announcement}
        message={announcement?.message ?? ''}
        onClose={dismissAnnouncement}
      />
    </>
  );
}
