import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './AppText';
import { Colors } from '../constants/colors';

interface Props {
  icon: string;
  title: string;
  description: string;
}

export default function ComingSoonScreen({ icon, title, description }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🚧 Σύντομα Διαθέσιμο</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    maxWidth: 360,
    width: '100%',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  badge: {
    backgroundColor: Colors.primaryHover,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 18,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
