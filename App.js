import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './src/utils/NavigationService'; 

// Importación de todos los Contextos globales
import { ThemeProvider } from './src/context/ThemeContext'; // 🌓 1. AGREGADO: Proveedor de Tema Oscuro/Claro
import { AuthProvider } from './src/context/AuthContext';
import { FinanceProvider } from './src/context/FinanceContext';

// Componente encargado de gestionar las pantallas y la pila de rutas
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    // 1. ThemeProvider en la cúspide para inyectar estilos visuales nativos persistidos
    <ThemeProvider>
      
      {/* 2. AuthProvider para monitorear tokens de sesión activos de Firebase / Google */}
      <AuthProvider>
        
        {/* 3. Contenedor de Navegación con la referencia global vinculada para redirecciones lógicas */}
        <NavigationContainer ref={navigationRef}>
          
          {/* 4. FinanceProvider adentro de la navegación para escuchar rutas y despachar alertas flotantes */}
          <FinanceProvider>
            
            {/* 5. Orquestador central de pantallas (Login, Registro y Dashboard) */}
            <AppNavigator />
            
          </FinanceProvider>
          
        </NavigationContainer>
        
      </AuthProvider>
      
    </ThemeProvider>
  );
}