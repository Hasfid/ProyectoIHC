import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, StyleSheet, Platform } from 'react-native';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      screenOptions={{
        tabBarActiveTintColor: '#004d40',
        tabBarInactiveTintColor: '#888',
        tabBarIndicatorStyle: { backgroundColor: '#004d40', top: 0, height: 3 },
        tabBarStyle: {
          backgroundColor: '#fff',
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + 10 : 15,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 75 + insets.bottom : 80,
        },
        tabBarShowIcon: true,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, marginTop: 4, textTransform: 'none', fontWeight: '500' },
        swipeEnabled: true,
        lazy: true,
      }}
    >
      <MaterialTopTabs.Screen
        name="index"
        options={{
          title: 'Descubrir',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "compass" : "compass-outline"} size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="observatory"
        options={{
          title: 'Observatorio',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "earth" : "earth-outline"} size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="scanner"
        options={{
          title: 'Escáner',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "scan-circle" : "scan-circle-outline"} size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="challenge"
        options={{
          title: 'Retos',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "trophy" : "trophy-outline"} size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="records"
        options={{
          title: 'Registros',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "library" : "library-outline"} size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />,
        }}
      />
    </MaterialTopTabs>
  );
}
