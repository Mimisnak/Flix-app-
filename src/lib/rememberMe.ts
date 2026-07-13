import AsyncStorage from '@react-native-async-storage/async-storage';

const REMEMBER_ME_KEY = 'flixfix_remember_me';
const REMEMBER_EMAIL_KEY = 'flixfix_remember_email';

export async function setRememberMe(remember: boolean, email: string) {
  await AsyncStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false');
  if (remember) {
    await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, email);
  } else {
    await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
  }
}

export async function getRememberedEmail(): Promise<string | null> {
  return AsyncStorage.getItem(REMEMBER_EMAIL_KEY);
}

// Session should only survive an app relaunch if the user explicitly opted
// in via "Remember me". Absence of the key (never logged in on this device,
// or an older build) defaults to trusting the session, so upgrades don't
// force a surprise logout.
export async function isRememberMeDisabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(REMEMBER_ME_KEY);
  return value === 'false';
}
