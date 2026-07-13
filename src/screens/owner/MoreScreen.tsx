import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';

const ITEMS: { label: string; icon: string; route: string }[] = [
  { label: 'Νέα Παραγγελία', icon: '➕', route: 'OwnerNewOrder' },
  { label: 'Εγκρίσεις', icon: '✅', route: 'Approvals' },
  { label: 'Χάρτης', icon: '🗺️', route: 'Map' },
  { label: 'Συνδρομή', icon: '💳', route: 'OwnerSubscription' },
  { label: 'Υποστήριξη', icon: '🎧', route: 'OwnerSupport' },
  { label: 'Προφίλ', icon: '👤', route: 'OwnerProfile' },
  { label: 'Οδηγός Χρήσης', icon: '📖', route: 'Help' },
];

export default function MoreScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>☰ Περισσότερα</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.row}
            onPress={() => navigation.navigate(item.route)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: 'bold' },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  icon: { fontSize: 20, marginRight: 14 },
  label: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  chevron: { color: Colors.textMuted, fontSize: 20 },
});
