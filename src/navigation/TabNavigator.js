import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Dimensions, PixelRatio, Platform } from 'react-native';
import DashboardScreen from '../screens/DashboardScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import BudgetsScreen from '../screens/BudgetsScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import NewsScreen from '../screens/NewsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { ThemeContext } from '../context/ThemeContext';

// EXPO FIX: Usamos la librería nativa de Expo para evitar romper las fuentes vectoriales
import Ionicons from '@expo/vector-icons/Ionicons';

// --- CONFIGURACIÓN DE RESPONSIVIDAD DINÁMICA ---
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 360; // Base móvil estándar

function normalize(size) {
  const newSize = size * scale;
  if (Platform.OS === 'android') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const { theme } = useContext(ThemeContext) || {};

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, focused }) => {
          let iconName = 'alert-circle';

          if (route.name === 'Dashboard') {
            iconName = focused ? 'pie-chart' : 'pie-chart-outline';
          } else if (route.name === 'Transacciones') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Presupuestos') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Horario') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Noticias') {
            iconName = focused ? 'newspaper' : 'newspaper-outline';
          } else if (route.name === 'Perfil') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={normalize(19)} color={color} />;
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: theme?.textSecondary || 'gray',

        tabBarLabelStyle: {
          fontSize: normalize(9.5),
          fontWeight: '600',
          paddingBottom: Platform.OS === 'ios' ? 0 : normalize(3),
        },

        tabBarStyle: {
          height: Platform.OS === 'ios' ? normalize(75) : normalize(62),
          paddingTop: normalize(5),
          backgroundColor: theme?.card || '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: theme?.border || '#E2E8F0',
        },

        headerShown: true,
        headerStyle: {
          backgroundColor: '#2196F3',
          height: Platform.OS === 'ios' ? normalize(90) : normalize(80),
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: normalize(16),
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{ 
          title: 'Resumen General',
          tabBarLabel: 'Resumen',
        }} 
      />
      <Tab.Screen 
        name="Transacciones" 
        component={TransactionsScreen} 
        options={{ 
          title: 'Historial de Movimientos',
          tabBarLabel: 'Movimientos',
        }} 
      />
      <Tab.Screen 
        name="Presupuestos" 
        component={BudgetsScreen} 
        options={{ 
          title: 'Límites de Gastos',
          tabBarLabel: 'Presupuestos',
        }} 
      />
      <Tab.Screen 
        name="Horario" 
        component={ScheduleScreen} 
        options={{ 
          title: 'Horario Institucional UDB',
          tabBarLabel: 'Horario',
        }} 
      />
      <Tab.Screen 
        name="Noticias" 
        component={NewsScreen} 
        options={{ 
          title: 'Noticias UDB',
          tabBarLabel: 'Noticias',
        }} 
      />
      <Tab.Screen 
        name="Perfil" 
        component={ProfileScreen} 
        options={{ 
          title: 'Mi Perfil Estudiantil',
          tabBarLabel: 'Perfil',
        }} 
      />
    </Tab.Navigator>
  );
}