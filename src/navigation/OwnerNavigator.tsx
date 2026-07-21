import React from 'react';
import { Dimensions, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LiveOrdersScreen from '../screens/owner/LiveOrdersScreen';
import MapScreen from '../screens/owner/MapScreen';
import ApprovalsScreen from '../screens/owner/ApprovalsScreen';
import DirectoryScreen from '../screens/owner/DirectoryScreen';
import SubscriptionScreen from '../screens/owner/SubscriptionScreen';
import OwnerHistoryScreen from '../screens/owner/OwnerHistoryScreen';
import StatsScreen from '../screens/owner/StatsScreen';
import OwnerNewOrderScreen from '../screens/owner/OwnerNewOrderScreen';
import MoreScreen from '../screens/owner/MoreScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SupportChatScreen from '../screens/SupportChatScreen';
import HelpScreen from '../screens/HelpScreen';
import AppUpdatesScreen from '../screens/AppUpdatesScreen';
import BetaBadge from '../components/BetaBadge';

const Tab = createBottomTabNavigator();

// Only 5 tabs stay visible in the bottom bar — the rest are still fully
// navigable (registered in this same Tab.Navigator, reachable from other
// screens' navigation.navigate() calls and from MoreScreen), just hidden
// from the bar itself. tabBarButton: () => null renders nothing for the
// slot; tabBarItemStyle width/flex: 0 additionally guarantees the flex row
// reserves zero space for it, so there's no invisible gap either.
const hidden = {
  tabBarButton: () => null,
  tabBarItemStyle: { width: 0, flex: 0, padding: 0, margin: 0 },
};

const icon = (emoji: string) => () => <Text style={{ fontSize: 24 }}>{emoji}</Text>;
// Plain vector icons for most tabs — emoji is kept only for Υποστήριξη,
// Συνδρομή, Χάρτης, Προφίλ.
const vicon = (name: React.ComponentProps<typeof Ionicons>['name']) =>
  ({ color, size }: { color: string; size: number }) => <Ionicons name={name} size={size} color={color} />;

// tabBarItemStyle: { flex: 1 } alone doesn't reliably stretch items to fill
// the bar on every device — fall back to computing an exact pixel width per
// visible tab from the screen width so there's never a leftover gap.
const VISIBLE_TAB_COUNT = 5;
const tabItemWidth = Dimensions.get('window').width / VISIBLE_TAB_COUNT;

export default function OwnerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#3A9EFB',
        tabBarInactiveTintColor: '#94a3b8',
        // Greek labels ("Οι παραγγελίες μου", "Περισσότερα"...) don't fit in
        // a 1/5-screen-wide tab even at a small font — icon-only avoids the
        // "Κα...", "Στ..." truncation. Mobile-only: this file never renders
        // on web (AppNavigator branches to WebApp/Sidebar there instead).
        tabBarShowLabel: false,
        tabBarStyle: { height: 56, paddingBottom: 8, paddingTop: 8 },
        tabBarItemStyle: { width: tabItemWidth },
        // App is in beta — keep a small reminder visible everywhere that
        // problems should be reported via the Support tab.
        headerRight: () => <BetaBadge />,
      }}
    >
      <Tab.Screen
        name="LiveOrders"
        component={LiveOrdersScreen}
        options={{ title: 'Live', tabBarIcon: vicon('pulse-outline') }}
      />
      <Tab.Screen
        name="Directory"
        component={DirectoryScreen}
        options={{ title: 'Κατάλογος', tabBarIcon: vicon('people-outline') }}
      />
      <Tab.Screen
        name="OwnerHistory"
        component={OwnerHistoryScreen}
        options={{ title: 'Ιστορικό', tabBarIcon: vicon('time-outline') }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{ title: 'Στατιστικά', tabBarIcon: vicon('stats-chart-outline') }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{ title: 'Περισσότερα', tabBarIcon: vicon('menu-outline') }}
      />

      {/* Hidden from the tab bar, still reachable via navigation.navigate() */}
      <Tab.Screen name="Map" component={MapScreen} options={{ title: 'Χάρτης', ...hidden }} />
      <Tab.Screen name="Approvals" component={ApprovalsScreen} options={{ title: 'Εγκρίσεις', ...hidden }} />
      <Tab.Screen name="OwnerSubscription" component={SubscriptionScreen} options={{ title: 'Συνδρομή', ...hidden }} />
      <Tab.Screen name="OwnerNewOrder" component={OwnerNewOrderScreen} options={{ title: 'Νέα Παραγγελία', ...hidden }} />
      <Tab.Screen name="OwnerSupport" component={SupportChatScreen} options={{ title: 'Υποστήριξη', ...hidden }} />
      <Tab.Screen name="OwnerProfile" component={ProfileScreen} options={{ title: 'Προφίλ', ...hidden }} />
      <Tab.Screen name="Help" component={HelpScreen} options={{ title: 'Οδηγός Χρήσης', ...hidden }} />
      <Tab.Screen name="AppUpdates" component={AppUpdatesScreen} options={{ title: 'Νέα της Εφαρμογής', ...hidden }} />
    </Tab.Navigator>
  );
}
