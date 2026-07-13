import React from 'react';
import { Dimensions, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ShopOrdersScreen from '../screens/shop/ShopOrdersScreen';
import ShopHistoryScreen from '../screens/shop/ShopHistoryScreen';
import NewOrderScreen from '../screens/shop/NewOrderScreen';
import SubscriptionScreen from '../screens/shop/SubscriptionScreen';
import MapScreen from '../screens/owner/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SupportChatScreen from '../screens/SupportChatScreen';
import BetaBadge from '../components/BetaBadge';

const Tab = createBottomTabNavigator();

const icon = (emoji: string) => () => <Text style={{ fontSize: 24 }}>{emoji}</Text>;

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
        options={{ title: 'Νέα Παραγγελία', tabBarIcon: icon('➕') }}
      />
      <Tab.Screen
        name="ShopOrders"
        component={ShopOrdersScreen}
        options={{ title: 'Παραγγελίες', tabBarIcon: icon('📦') }}
      />
      <Tab.Screen
        name="ShopHistory"
        component={ShopHistoryScreen}
        options={{ title: 'Ιστορικό', tabBarIcon: icon('📋') }}
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
    </Tab.Navigator>
  );
}
