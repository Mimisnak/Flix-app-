import React from 'react';
import { Dimensions, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ShopOrdersScreen from '../screens/shop/ShopOrdersScreen';
import ShopHistoryScreen from '../screens/shop/ShopHistoryScreen';
import NewOrderScreen from '../screens/shop/NewOrderScreen';
import SubscriptionScreen from '../screens/shop/SubscriptionScreen';
import MapScreen from '../screens/owner/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SupportChatScreen from '../screens/SupportChatScreen';
import HelpScreen from '../screens/HelpScreen';
import AppUpdatesScreen from '../screens/AppUpdatesScreen';
import BetaBadge from '../components/BetaBadge';

const Tab = createBottomTabNavigator();

// Help is reachable from the Profile screen's link, not from the tab bar —
// there's no spare room in a 7-tab bar. Same tabBarButton: () => null
// pattern used for hidden screens in OwnerNavigator/DeveloperNavigator.
const hidden = {
  tabBarButton: () => null,
  tabBarItemStyle: { width: 0, flex: 0, padding: 0, margin: 0 },
};

const icon = (emoji: string) => () => <Text style={{ fontSize: 24 }}>{emoji}</Text>;
// Plain vector icons for most tabs — emoji is kept only for Χάρτης,
// Συνδρομή, Υποστήριξη, Προφίλ.
const vicon = (name: React.ComponentProps<typeof Ionicons>['name']) =>
  ({ color, size }: { color: string; size: number }) => <Ionicons name={name} size={size} color={color} />;

const VISIBLE_TAB_COUNT = 7;
const tabItemWidth = Dimensions.get('window').width / VISIBLE_TAB_COUNT;

export default function ShopNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#3A9EFB',
        tabBarInactiveTintColor: '#94a3b8',
        // Icon-only on mobile — long Greek labels don't fit 6 tabs on a
        // phone-width bar even at a small font. Never affects the web
        // Sidebar, which is a separate component tree (WebApp.web.tsx).
        tabBarShowLabel: false,
        tabBarStyle: { height: 56, paddingBottom: 8, paddingTop: 8 },
        tabBarItemStyle: { width: tabItemWidth },
        // App is in beta — keep a small reminder visible everywhere that
        // problems should be reported via the Support tab.
        headerRight: () => <BetaBadge />,
      }}
    >
      <Tab.Screen
        name="NewOrder"
        component={NewOrderScreen}
        options={{ title: 'Νέα Παραγγελία', tabBarIcon: vicon('add-circle-outline') }}
      />
      <Tab.Screen
        name="ShopOrders"
        component={ShopOrdersScreen}
        options={{ title: 'Παραγγελίες', tabBarIcon: vicon('cube-outline') }}
      />
      <Tab.Screen
        name="ShopHistory"
        component={ShopHistoryScreen}
        options={{ title: 'Ιστορικό', tabBarIcon: vicon('time-outline') }}
      />
      <Tab.Screen
        name="ShopMap"
        component={MapScreen}
        options={{ title: 'Χάρτης', tabBarIcon: icon('🗺️') }}
      />
      <Tab.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ title: 'Συνδρομή', tabBarIcon: icon('💳') }}
      />
      <Tab.Screen
        name="ShopSupport"
        component={SupportChatScreen}
        options={{ title: 'Υποστήριξη', tabBarIcon: icon('🎧') }}
      />
      <Tab.Screen
        name="ShopProfile"
        component={ProfileScreen}
        options={{ title: 'Προφίλ', tabBarIcon: icon('👤') }}
      />

      {/* Hidden from the tab bar, reachable from the Profile screen's link */}
      <Tab.Screen name="Help" component={HelpScreen} options={{ title: 'Οδηγός Χρήσης', ...hidden }} />
      <Tab.Screen name="AppUpdates" component={AppUpdatesScreen} options={{ title: 'Νέα της Εφαρμογής', ...hidden }} />
    </Tab.Navigator>
  );
}
