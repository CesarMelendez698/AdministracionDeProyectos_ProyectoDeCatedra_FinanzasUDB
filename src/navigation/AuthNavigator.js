import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Dimensions, PixelRatio, Platform } from 'react-native';

// Importación de pantallas de autenticación integradas y responsivas
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

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

const Stack = createStackNavigator();

export default function AuthNavigator() {
  return (
    /* screenOptions={{ headerShown: false }} oculta la barra superior por defecto, 
      permitiendo que el diseño responsivo unificado del Login y Registro ocupe 
      el 100% del espacio útil del dispositivo sin desfases de área segura.
    */
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        // CardStyle Interpolator opcional por si deseas forzar transiciones suaves y fluidas en Android
        cardStyle: { backgroundColor: '#FFFFFF' }
      }}
    >
      {/* Primera pantalla en montarse por defecto al no haber sesión activa */}
      <Stack.Screen name="Login" component={LoginScreen} />
      
      {/* Pantalla secundaria accesible mediante la navegación local */}
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}