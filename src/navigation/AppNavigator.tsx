import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import DashboardScreen from '../screens/DashboardScreen';
import CardDetailScreen from '../screens/CardDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AddCardModal from '../screens/AddCardModal';
import AddTransactionModal from '../screens/AddTransactionModal';
import AddCategoryModal from '../screens/AddCategoryModal';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function DashboardStackNavigator() {
  const { appTheme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: appTheme.colors.background },
      }}
    >
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
      <Stack.Screen
        name="CardDetail"
        component={CardDetailScreen}
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="AddCard"
        component={AddCardModal}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionModal}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AddCategory"
        component={AddCategoryModal}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { appTheme } = useTheme();

  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: appTheme.colors.background }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: IconName = 'home';

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'cog' : 'cog-outline';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: appTheme.colors.onSurface,
        tabBarInactiveTintColor: appTheme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: appTheme.colors.surface,
          borderTopColor: appTheme.colors.surfaceVariant,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 2,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStackNavigator}
        options={{
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}
