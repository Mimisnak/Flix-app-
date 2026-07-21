import React from 'react';
import { Dimensions, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AvailableOrdersScreen from '../screens/driver/AvailableOrdersScreen';
import MyOrdersScreen from '../screens/driver/MyOrdersScreen';
import DriverHistoryScreen from '../screens/driver/DriverHistoryScreen';
import MapScreen from '../screens/owner/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SupportChatScreen from '../screens/SupportChatScreen';
import HelpScreen from '../screens/HelpScreen';
import AppUpdatesScreen from '../screens/AppUpdatesScreen';
import BetaBadge from '../components/BetaBadge';

const Tab = createBottomTabNavigator();

// Help is reachable from the Profile screen's link, not from the tab bar —
// there's no spare room in a 6-tab bar. Same tabBarButton: () => null
// pattern used for hidden screens in OwnerNavigator/DeveloperNavigator.
const hidden = {
  tabBarButton: () => null,
  tabBarItemStyle: { width: 0, flex: 0, padding: 0, margin: 0 },
};

const icon = (emoji: string) => () => <Text style={{ fontSize: 24 }}>{emoji}</Text>;
// Plain vector icons for most tabs — emoji is kept only for Χάρτης,
// Υποστήριξη, Προφίλ.
const vicon = (name: React.ComponentProps<typeof Ionicons>['name']) =>
  ({ color, size }: { color: string; size: number }) => <Ionicons name={name} size={size} color={color} />;

const VISIBLE_TAB_COUNT = 6;
const tabItemWidth = Dimensions.get('window').width / VISIBLE_TAB_COUNT;

export default function DriverNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#3A9EFB',
        tabBarInactiveTintColor: '#94a3b8',
        // Icon-only on mobile — "Οι παραγγελίες μου" never fits a tab this
        // narrow. Never affects the web Sidebar (separate component tree).
        tabBarShowLabel: false,
        tabBarStyle: { height: 56, paddingBottom: 8, paddingTop: 8 },
        tabBarItemStyle: { width: tabItemWidth },
        // App is in beta — keep a small reminder visible everywhere that
        // problems should be reported via the Support tab.
        headerRight: () => <BetaBadge />,
      }}
    >
      <Tab.Screen
        name="Available"
        component={AvailableOrdersScreen}
        options={{ title: 'Διαθέσιμες', tabBarIcon: vicon('notifications-outline') }}
      />
      <Tab.Screen
        name="MyOrders"
        component={MyOrdersScreen}
        options={{ title: 'Οι παραγγελίες μου', tabBarIcon: vicon('navigate-outline') }}
      />
      <Tab.Screen
        name="DriverHistory"
        component={DriverHistoryScreen}
        options={{ title: 'Ιστορικό', tabBarIcon: vicon('time-outline') }}
      />
      <Tab.Screen
        name="DriverMap"
        component={MapScreen}
        options={{ title: 'Χάρτης', tabBarIcon: icon('🗺️') }}
      />
      <Tab.Screen
        name="DriverSupport"
        component={SupportChatScreen}
        options={{ title: 'Υποστήριξη', tabBarIcon: icon('🎧') }}
      />
      <Tab.Screen
        name="DriverProfile"
        component={ProfileScreen}
        options={{ title: 'Προφίλ', tabBarIcon: icon('👤') }}
      />

      {/* Hidden from the tab bar, reachable from the Profile screen's link */}
      <Tab.Screen name="Help" component={HelpScreen} options={{ title: 'Οδηγός Χρήσης', ...hidden }} />
      <Tab.Screen name="AppUpdates" component={AppUpdatesScreen} options={{ title: 'Νέα της Εφαρμογής', ...hidden }} />
    </Tab.Navigator>
  );
}
