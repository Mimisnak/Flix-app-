import React from 'react';
import { Dimensions, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import SupportInboxScreen from '../screens/developer/SupportInboxScreen';
import AccountsScreen from '../screens/developer/AccountsScreen';
import LiveOrdersScreen from '../screens/owner/LiveOrdersScreen';
import StatsScreen from '../screens/owner/StatsScreen';
import OwnerHistoryScreen from '../screens/owner/OwnerHistoryScreen';
import MoreScreen from '../screens/developer/MoreScreen';
import ProfileScreen from '../screens/ProfileScreen';
import HelpScreen from '../screens/HelpScreen';
import BetaBadge from '../components/BetaBadge';

const Tab = createBottomTabNavigator();

// tabBarButton: () => null renders nothing for the slot; tabBarItemStyle
// width/flex: 0 additionally guarantees the flex row reserves zero space
// for it, so there's no invisible gap either.
const hidden = {
  tabBarButton: () => null,
  tabBarItemStyle: { width: 0, flex: 0, padding: 0, margin: 0 },
};

const icon = (emoji: string) => () => <Text style={{ fontSize: 24 }}>{emoji}</Text>;
// Plain vector icons for most tabs — emoji is kept only for Υποστήριξη,
// Συνδρομή, Χάρτης, Προφίλ.
const vicon = (name: React.ComponentProps<typeof Ionicons>['name']) =>
  ({ color, size }: { color: string; size: number }) => <Ionicons name={name} size={size} color={color} />;

const VISIBLE_TAB_COUNT = 5;
const tabItemWidth = Dimensions.get('window').width / VISIBLE_TAB_COUNT;

export default function DeveloperNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#3A9EFB',
        tabBarInactiveTintColor: '#94a3b8',
        // Icon-only on mobile — "Λογαριασμοί"/"Υποστήριξη"/"Περισσότερα"
        // truncate at any font size that fits 5 tabs. Never affects the web
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
        name="SupportInbox"
        component={SupportInboxScreen}
        options={{ title: 'Υποστήριξη', tabBarIcon: icon('🎧') }}
      />
      <Tab.Screen
        name="Accounts"
        component={AccountsScreen}
        options={{ title: 'Λογαριασμοί', tabBarIcon: vicon('people-circle-outline') }}
      />
      <Tab.Screen
        name="DevLiveOrders"
        component={LiveOrdersScreen}
        options={{ title: 'Live', tabBarIcon: vicon('pulse-outline') }}
      />
      <Tab.Screen
        name="DevHistory"
        component={OwnerHistoryScreen}
        options={{ title: 'Ιστορικό', tabBarIcon: vicon('time-outline') }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{ title: 'Περισσότερα', tabBarIcon: vicon('menu-outline') }}
      />

      {/* Hidden from the tab bar, still reachable via navigation.navigate() */}
      <Tab.Screen name="DevStats" component={StatsScreen} options={{ title: 'Στατιστικά', ...hidden }} />
      <Tab.Screen name="DevProfile" component={ProfileScreen} options={{ title: 'Προφίλ', ...hidden }} />
      <Tab.Screen name="Help" component={HelpScreen} options={{ title: 'Οδηγός Χρήσης', ...hidden }} />
    </Tab.Navigator>
  );
}
