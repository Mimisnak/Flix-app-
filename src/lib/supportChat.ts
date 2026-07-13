import { supabase } from './supabase';
import { SupportMessage } from '../types';

/** Το δικό μου (τρέχοντος λογαριασμού) support thread, παλιότερο → πιο πρόσφατο. */
export async function fetchOwnThread(userId: string): Promise<SupportMessage[]> {
  const { data } = await supabase
    .from('support_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return (data as SupportMessage[]) ?? [];
}

export async function sendUserMessage(userId: string, message: string): Promise<void> {
  await supabase.from('support_messages').insert({
    user_id: userId,
    sender_role: 'user',
    message,
  });
}

export async function sendDeveloperReply(userId: string, message: string): Promise<void> {
  await supabase.from('support_messages').insert({
    user_id: userId,
    sender_role: 'developer',
    message,
  });
}

export async function markThreadRead(userId: string): Promise<void> {
  await supabase
    .from('support_messages')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}
