import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
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
  const systemScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemScheme === 'dark');
  const [themeLoading, setThemeLoading] = useState(true);

  // Carga la preferencia guardada al relanzar la app
  useEffect(() => {
    let isMounted = true;
    const loadPersistedTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('@user_theme_preference');
        if (isMounted) {
          if (savedTheme !== null) {
            setIsDarkMode(savedTheme === 'dark');
          } else {
            setIsDarkMode(systemScheme === 'dark');
          }
        }
      } catch (error) {
        console.error('Error cargando el tema persistente:', error);
      } finally {
        if (isMounted) setThemeLoading(false);
      }
    };
    loadPersistedTheme();
    return () => { isMounted = false; };
  }, [systemScheme]);

  // Alternar el tema al instante (0ms lag en UI) y persistir en segundo plano
  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev;
      AsyncStorage.setItem('@user_theme_preference', next ? 'dark' : 'light').catch(err => {
        console.error('Error guardando la preferencia de tema:', err);
      });
      return next;
    });
  }, []);

  const theme = useMemo(() => (isDarkMode ? darkTheme : lightTheme), [isDarkMode]);

  const contextValue = useMemo(() => ({
    isDarkMode,
    theme,
    toggleTheme,
    themeLoading
  }), [isDarkMode, theme, toggleTheme, themeLoading]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};