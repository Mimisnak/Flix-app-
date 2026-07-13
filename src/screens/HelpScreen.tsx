import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { HELP_CONTENT } from '../lib/helpContent';

export default function HelpScreen() {
  const [role, setRole] = useState<string>('');

  useEffect(() => { loadRole(); }, []);

  async function loadRole() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (data) setRole(data.role);
  }

  const content = HELP_CONTENT[role];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>📖 {content?.title ?? 'Οδηγός Χρήσης'}</Text>
      </LinearGradient>

      {content?.sections.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item, i) => (
            <Text key={i} style={styles.item}>•  {item}</Text>
          ))}
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerThanks}>Ευχαριστούμε που χρησιμοποιείς τις υπηρεσίες της Flix!</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://mimis.dev/')}>
          <Text style={styles.footerCredit}>Created by mimis.dev — for ideas & projects</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 24, paddingTop: 32 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  section: {
    backgroundColor: Colors.surface, margin: 12, marginBottom: 0, marginTop: 12,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
  item: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  footer: { alignItems: 'center', marginTop: 28, paddingHorizontal: 24 },
  footerThanks: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 6 },
  footerCredit: { color: Colors.textMuted, fontSize: 11, textAlign: 'center' },
});
