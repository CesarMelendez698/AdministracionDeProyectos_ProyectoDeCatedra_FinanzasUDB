import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext();

// 🎨 DEFINICIÓN DE PALETAS DE COLORES FINTECH
export const lightTheme = {
  dark: false,
  background: '#F8FAFC',       // Fondo general grisáceo suave
  card: '#FFFFFF',             // Tarjetas e inputs blancos
  textPrimary: '#0F172A',      // Slate 900 (Textos principales)
  textSecondary: '#64748B',    // Slate 500 (Subtítulos)
  border: '#E2E8F0',           // Bordes limpios
  premiumCard: '#1E293B',      // Tarjeta de balance azul oscuro permanente
  premiumText: '#94A3B8',
  accent: '#6366F1',           // Indigo para botones y avatares
  success: '#10B981',
  danger: '#EF4444',
  warning: '#E65100',
};

export const darkTheme = {
  dark: true,
  background: '#0F172A',       // Slate 900 (Fondo oscuro profundo)
  card: '#1E293B',             // Slate 800 (Tarjetas oscuras)
  textPrimary: '#F8FAFC',      // Texto blanco/gris claro
  textSecondary: '#94A3B8',    // Texto secundario atenuado
  border: '#334155',           // Bordes oscuros integrados
  premiumCard: '#1E293B',      // Mismo color para consistencia visual
  premiumText: '#94A3B8',
  accent: '#818CF8',           // Indigo brillante adaptado a modo oscuro
  success: '#34D399',
  danger: '#F87171',
  warning: '#FBBF24',
};

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme(); // Captura el tema por defecto del sistema operativo
  const [isDarkMode, setIsDarkMode] = useState(systemScheme === 'dark');
  const [themeLoading, setThemeLoading] = useState(true);

  // Carga la preferencia guardada al relanzar la app
  useEffect(() => {
    const loadPersistedTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('@user_theme_preference');
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'dark');
        } else {
          setIsDarkMode(systemScheme === 'dark');
        }
      } catch (error) {
        console.error('Error cargando el tema persistente:', error);
      } finally {
        setThemeLoading(false);
      }
    };
    loadPersistedTheme();
  }, [systemScheme]);

  // Función para alternar el tema y persistirlo localmente
  const toggleTheme = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      await AsyncStorage.setItem('@user_theme_preference', newMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Error guardando la preferencia de tema:', error);
    }
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, theme, toggleTheme, themeLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};