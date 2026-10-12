import React, { useState, useContext } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  Dimensions,
  PixelRatio,
  Platform
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
// IMPORTACIÓN DE EXPO VECTOR ICONS
import Ionicons from '@expo/vector-icons/Ionicons';

// --- CONFIGURACIÓN DE RESPONSIVIDAD DINÁMICA ---
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 360; // Base estándar móvil

function normalize(size) {
  const newSize = size * scale;
  if (Platform.OS === 'android') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export default function RegisterScreen({ navigation }) {
  // ESTADOS DEL FORMULARIO
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // ESTADO INTERNO: Ocultar o mostrar contraseña
  const [secureText, setSecureText] = useState(true);
  
  // Consumo del AuthContext
  const { register, loading } = useContext(AuthContext);

  // FUNCIÓN FILTRADORA: Remueve números al escribir
  const handleNameChange = (text, setTargetState) => {
    const cleanText = text.replace(/[0-9]/g, '');
    setTargetState(cleanText);
  };

  const handleRegister = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      Alert.alert('Campos incompletos', 'Por favor, llena todos los campos para crear tu cuenta.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Contraseña muy corta', 'La contraseña debe contener al menos 6 caracteres.');
      return;
    }

    // Envío ordenado de variables estructurado según el Core Context
    register(email, password, firstName, lastName);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nueva Cuenta</Text>
      
      {/* Campo de Entrada: Nombre */}
      <TextInput 
        style={styles.input} 
        placeholder="Nombre" 
        value={firstName} 
        onChangeText={(text) => handleNameChange(text, setFirstName)} 
        autoCapitalize="words" 
        placeholderTextColor="#aaa"
      />

      {/* Campo de Entrada: Apellido */}
      <TextInput 
        style={styles.input} 
        placeholder="Apellido" 
        value={lastName} 
        onChangeText={(text) => handleNameChange(text, setLastName)} 
        autoCapitalize="words" 
        placeholderTextColor="#aaa"
      />

      {/* Campo de Entrada: Correo Electrónico */}
      <TextInput 
        style={styles.input} 
        placeholder="Correo Electrónico" 
        value={email} 
        onChangeText={setEmail} 
        autoCapitalize="none" 
        keyboardType="email-address" 
        placeholderTextColor="#aaa"
      />
      
      {/* CONTENEDOR SIMÉTRICO: Input de Contraseña + Icono de Ojo */}
      <View style={styles.passwordContainer}>
        <TextInput 
          style={styles.passwordInput} 
          placeholder="Contraseña (Mínimo 6 caracteres)" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry={secureText} 
          placeholderTextColor="#aaa"
        />
        <TouchableOpacity 
          style={styles.eyeButton} 
          onPress={() => setSecureText(!secureText)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={secureText ? 'eye-off' : 'eye'} 
            size={normalize(22)} 
            color="#888" 
          />
        </TouchableOpacity>
      </View>

      {/* Control del Spinner de carga global */}
      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginVertical: normalize(10) }} />
      ) : (
        <TouchableOpacity style={[styles.btn, { backgroundColor: '#4CAF50' }]} onPress={handleRegister}>
          <Text style={styles.btnText}>Crear Cuenta</Text>
        </TouchableOpacity>
      )}

      {/* Enlace de retorno al Login */}
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>¿Ya tienes cuenta? Inicia sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: normalize(24), 
    backgroundColor: '#fff' 
  },
  title: { 
    fontSize: normalize(28), 
    fontWeight: 'bold', 
    color: '#4CAF50', 
    marginBottom: normalize(24), 
    textAlign: 'center' 
  },
  input: { 
    backgroundColor: '#f5f5f5', 
    padding: normalize(16), 
    borderRadius: normalize(8), 
    marginBottom: normalize(16), 
    fontSize: normalize(16),
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
    height: normalize(54)
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: normalize(16),
    borderRadius: normalize(8),
    marginBottom: normalize(16),
    borderWidth: 1,
    borderColor: '#e9ecef',
    height: normalize(54) 
  },
  passwordInput: {
    flex: 1,
    fontSize: normalize(16),
    color: '#333',
    paddingVertical: 0
  },
  eyeButton: {
    paddingLeft: normalize(10),
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%'
  },
  btn: { 
    padding: normalize(16), 
    borderRadius: normalize(8), 
    alignItems: 'center',
    justifyContent: 'center',
    height: normalize(54),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  btnText: { 
    color: '#fff', 
    fontSize: normalize(16), 
    fontWeight: 'bold' 
  },
  link: { 
    color: '#4CAF50', 
    textAlign: 'center', 
    marginTop: normalize(20),
    fontWeight: '600',
    fontSize: normalize(14)
  }
});