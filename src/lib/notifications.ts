import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushToken(): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    const { data: { user } } = await supabase.auth.getUser();
    if (user && token) {
      await supabase.from('users').update({ push_token: token }).eq('id', user.id);
    }
  } catch (_) {
    // Push notifications may not work on all simulators/emulators
  }
}

export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
): Promise<void> {
  try {
    const { data } = await supabase
      .from('users')
      .select('push_token')
      .in('id', userIds)
      .not('push_token', 'is', null);

    if (!data?.length) return;
    const tokens = data.map((u: any) => u.push_token).filter(Boolean);
    if (!tokens.length) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(tokens.map((to: string) => ({ to, sound: 'default', title, body }))),
    });
  } catch (_) {}
}

export async function sendPushToOnlineDrivers(title: string, body: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'driver')
      .eq('online_status', true);

    if (!data?.length) return;
    await sendPushToUsers(data.map((u: any) => u.id), title, body);
  } catch (_) {}
}
