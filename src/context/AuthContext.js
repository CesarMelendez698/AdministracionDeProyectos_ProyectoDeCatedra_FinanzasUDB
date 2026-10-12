import React, { createContext, useState, useEffect, useMemo } from 'react';
import { auth } from '../config/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile // 1. IMPORTACIÓN OBLIGATORIA: Para guardar nombre y apellido
} from 'firebase/auth';
import { Alert, Dimensions, PixelRatio, Platform } from 'react-native';

export const AuthContext = createContext();

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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Almacenamos tanto el uid, email como el displayName actualizado
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName 
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  // 2. CORRECCIÓN DEL MÉTODO: Ahora recibe firstName y lastName desde RegisterScreen
  const register = async (email, password, firstName, lastName) => {
    try {
      setLoading(true);
      
      // Crea el usuario en Firebase con las credenciales básicas
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      // Combina los campos de texto del estudiante
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      
      // Impacta directamente el perfil nativo en los servidores de Firebase
      await updateProfile(userCredential.user, {
        displayName: fullName
      });

      // Forzamos la actualización del estado local para que el Dashboard lo renderice inmediatamente
      setUser({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: fullName
      });

      Alert.alert('Registro Exitoso', 'Tu cuenta UDB ha sido creada e ingresada al sistema.');
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email) => {
    if (!email.trim()) {
      Alert.alert('Campo requerido', 'Por favor, escribe tu correo electrónico.');
      return;
    }
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Correo Enviado', 'Se ha enviado un enlace de restauración a tu correo.');
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const handleAuthError = (error) => {
    const code = error?.code || '';
    switch (code) {
      // 1. Error en contraseña o credenciales incorrectas
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        Alert.alert(
          'Credenciales Incorrectas',
          'La contraseña o el correo electrónico son incorrectos. Por favor, verifícalos e intenta de nuevo.'
        );
        break;

      // 2. Usuario no encontrado / correo no registrado
      case 'auth/user-not-found':
        Alert.alert(
          'Correo No Registrado',
          'No existe ninguna cuenta asociada a este correo electrónico. Puedes crear una desde la opción "Registrarse".'
        );
        break;

      // 3. Formato de correo inválido
      case 'auth/invalid-email':
        Alert.alert(
          'Correo Inválido',
          'El formato del correo electrónico ingresado no es válido (ejemplo: usuario@udb.edu.sv).'
        );
        break;

      // 4. Correo ya registrado
      case 'auth/email-already-in-use':
        Alert.alert(
          'Correo Ya Registrado',
          'Este correo electrónico ya pertenece a una cuenta registrada. Puedes iniciar sesión o restablecer tu contraseña.'
        );
        break;

      // 5. Contraseña débil
      case 'auth/weak-password':
        Alert.alert(
          'Contraseña Muy Débil',
          'Por tu seguridad, la contraseña debe contener al menos 6 caracteres.'
        );
        break;

      // 6. Demasiados intentos fallidos / cuenta bloqueada temporalmente
      case 'auth/too-many-requests':
        Alert.alert(
          'Demasiados Intentos',
          'Has realizado demasiados intentos fallidos seguidos. Por seguridad, espera unos momentos antes de reintentar.'
        );
        break;

      // 7. Cuenta deshabilitada por el administrador
      case 'auth/user-disabled':
        Alert.alert(
          'Cuenta Inactiva',
          'Esta cuenta ha sido deshabilitada temporalmente. Comunícate con soporte institucional.'
        );
        break;

      // 8. Problemas de red / conexión
      case 'auth/network-request-failed':
        Alert.alert(
          'Sin Conexión',
          'No se pudo conectar a los servidores. Revisa tu conexión a internet e inténtalo de nuevo.'
        );
        break;

      // 9. Operación no permitida
      case 'auth/operation-not-allowed':
        Alert.alert(
          'Acceso No Disponible',
          'El método de autenticación no está disponible en este momento.'
        );
        break;

      default:
        // Mensaje amigable por si es un error no catalogado en lugar de 'Error de Servidor'
        Alert.alert(
          'Aviso de Autenticación',
          'No se pudo completar la operación. Por favor revisa los datos ingresados e intenta nuevamente.'
        );
    }
  };

  const contextValue = useMemo(() => ({
    user, 
    loading, 
    login, 
    register, 
    logout, 
    resetPassword, 
    normalize 
  }), [user, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};