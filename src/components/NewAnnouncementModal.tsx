import React from 'react';
import { Modal, TouchableOpacity, View, StyleSheet } from 'react-native';
import Text from './AppText';
import { Colors } from '../constants/colors';

interface Props {
  visible: boolean;
  message: string;
  onClose: () => void;
}

// Shown once per new app_announcements row per device — see
// checkForNewAnnouncement() in navigation/AppNavigator.tsx. Works on both
// native and web since RN's Modal renders through react-native-web too, so
// this one component covers both without a separate web implementation.
export default function NewAnnouncementModal({ visible, message, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Νέα της Εφαρμογής</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.okBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.okBtnText}>Το κατάλαβα</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 400, backgroundColor: Colors.surface, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  closeBtnText: { color: Colors.textSecondary, fontSize: 18, fontWeight: 'bold' },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: 'bold', marginBottom: 12, paddingRight: 20 },
  message: { color: Colors.textPrimary, fontSize: 15, lineHeight: 22 },
  okBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 18 },
  okBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
