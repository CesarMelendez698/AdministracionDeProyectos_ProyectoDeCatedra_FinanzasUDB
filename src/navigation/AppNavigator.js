import React, { useContext } from 'react';
import { View, ActivityIndicator, StyleSheet, Dimensions, PixelRatio, Platform } from 'react-native';
import { AuthContext } from '../context/AuthContext';

// Importación de los sub-navegadores de la arquitectura
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';

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

export default function AppNavigator() {
  // Consumimos el estado reactivo del usuario y de carga desde Firebase Auth
  const { user, loading } = useContext(AuthContext);

  // REQUISITO DE USABILIDAD: Mientras Firebase verifica si hay un token de sesión
  // guardado localmente en el dispositivo, se muestra una pantalla de carga limpia.
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator 
          size={Platform.OS === 'ios' ? 'large' : normalize(36)} 
          color="#2196F3" 
        />
      </View>
    );
  }

  /* REQUISITO DE SEGURIDAD (Rutas Protegidas):
    Si 'user' existe (contiene uid y email de Firebase), se monta el ecosistema de pestañas.
    Si es null, se monta el flujo de Login y Registro impidiendo accesos no autorizados.

    💡 CORRECCIÓN: Se removieron las etiquetas <NavigationContainer> de este archivo 
    porque el contenedor ya fue declarado en la raíz (App.js) inyectando la referencia global.
  */
  return user ? <TabNavigator /> : <AuthNavigator />;
}

const styles = StyleSheet.create({
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  }
});