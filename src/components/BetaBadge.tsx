import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function BetaBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>BETA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 12,
  },
  text: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
