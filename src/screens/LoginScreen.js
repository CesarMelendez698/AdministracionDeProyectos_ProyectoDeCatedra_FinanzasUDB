import React, { useState, useContext } from 'react';
// IMPORTACIÓN DE MODAL: Añadimos Modal para la ventana emergente de recuperación
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  Modal,
  Dimensions,
  PixelRatio,
  Platform
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
// IMPORTE DE EXPO VECTOR ICONS
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

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // ESTADOS PARA EL MODAL
  const [modalVisible, setModalVisible] = useState(false); 
  const [resetEmail, setResetEmail] = useState(''); 
  const [localLoading, setLocalLoading] = useState(false); 

  // ESTADO INTERNO: Ocultar o mostrar contraseña
  const [secureText, setSecureText] = useState(true);
  
  // Consumo de propiedades de autenticación del Contexto
  const { login, loading, resetPassword } = useContext(AuthContext);

  // Manejador del flujo de inicio de sesión
  const handleLogin = () => {
    if (!email.trim() || !password) {
      Alert.alert('Campos incompletos', 'Por favor, ingresa tu correo y contraseña.');
      return;
    }
    login(email, password);
  };

  // Manejador del envío del correo desde la ventana Modal
  const handleModalSubmit = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('Campo requerido', 'Por favor, escribe tu correo electrónico.');
      return;
    }

    try {
      setLocalLoading(true);
      await resetPassword(resetEmail);
      
      // FLUJO DE ÉXITO: Cierre de modal y limpieza limpia
      setModalVisible(false);
      setResetEmail('');
    } catch (error) {
      console.log("Error en recuperación desde LoginScreen:", error);
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* SECCIÓN VISUAL: Identidad e información */}
      <Text style={styles.logo}>Finanzas UDB</Text>
      <Text style={styles.tagline}>Diseño y Programación de Software Multiplataforma</Text>

      {/* ENTRADA DE DATOS: Correo electrónico */}
      <TextInput 
        style={styles.input} 
        placeholder="Correo electrónico" 
        value={email} 
        onChangeText={setEmail} 
        autoCapitalize="none" 
        keyboardType="email-address" 
        placeholderTextColor="#aaa"
      />
      
      {/* CONTENEDOR SIMÉTRICO DE CONTRASEÑA */}
      <View style={styles.passwordContainer}>
        <TextInput 
          style={styles.passwordInput} 
          placeholder="Contraseña" 
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

      {/* ENLACE SECUNDARIO: Disparador del Modal */}
      <TouchableOpacity 
        style={styles.forgotContainer} 
        onPress={() => setModalVisible(true)}
        activeOpacity={0.6}
      >
        <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>

      {/* Control de carga para inicio de sesión */}
      {loading ? (
        <ActivityIndicator size="large" color="#2196F3" style={{ marginVertical: normalize(10) }} />
      ) : (
        <TouchableOpacity style={styles.btn} onPress={handleLogin}>
          <Text style={styles.btnText}>Ingresar</Text>
        </TouchableOpacity>
      )}

      {/* Redirección hacia el Stack de Registro */}
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>¿No tienes cuenta? Regístrate</Text>
      </TouchableOpacity>

      {/* ==================== COMPONENTE MODAL DE RECUPERACIÓN ==================== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Recuperar Contraseña</Text>
            <Text style={styles.modalDescription}>
              Ingresa tu correo institucional o registrado. Te enviaremos un enlace seguro para restablecer tu clave.
            </Text>

            {/* Input del correo dentro del Modal unificado */}
            <TextInput
              style={styles.input}
              placeholder="Correo electrónico"
              value={resetEmail}
              onChangeText={setResetEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#aaa"
            />

            {/* Fila de acciones del Modal */}
            {localLoading ? (
              <ActivityIndicator size="small" color="#2196F3" style={{ marginVertical: normalize(10) }} />
            ) : (
              <View style={styles.modalButtonsRow}>
                {/* Botón Cancelar */}
                <TouchableOpacity 
                  style={[styles.modalButton, styles.modalButtonCancel]} 
                  onPress={() => {
                    setModalVisible(false);
                    setResetEmail('');
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>

                {/* Botón Enviar Solicitud */}
                <TouchableOpacity 
                  style={[styles.modalButton, styles.modalButtonSubmit]} 
                  onPress={handleModalSubmit}
                >
                  <Text style={styles.modalButtonSubmitText}>Enviar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  logo: { 
    fontSize: normalize(32), 
    fontWeight: 'bold', 
    textAlign: 'center', 
    color: '#2196F3' 
  },
  tagline: { 
    fontSize: normalize(11), 
    textAlign: 'center', 
    color: '#888', 
    marginBottom: normalize(32), 
    marginTop: normalize(4),
    textTransform: 'uppercase',
    letterSpacing: 0.5
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
    width: '100%',
    height: normalize(54)
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: normalize(16), 
    borderRadius: normalize(8),
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
  forgotContainer: {
    alignSelf: 'flex-end',
    marginTop: normalize(4),
    marginBottom: normalize(24)
  },
  forgotText: {
    color: '#666',
    fontSize: normalize(14),
    fontWeight: '500',
    textDecorationLine: 'underline'
  },
  btn: { 
    backgroundColor: '#2196F3', 
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
    color: '#2196F3', 
    textAlign: 'center', 
    marginTop: normalize(20),
    fontWeight: '600',
    fontSize: normalize(14)
  },

  /* INTERFAZ MODAL RESPONSIVA */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'center',
    alignItems: 'center',
    padding: normalize(24)
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: normalize(16),
    padding: normalize(24),
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  modalTitle: {
    fontSize: normalize(20),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: normalize(12)
  },
  modalDescription: {
    fontSize: normalize(13),
    color: '#666',
    textAlign: 'center',
    marginBottom: normalize(20),
    lineHeight: normalize(19)
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: normalize(8)
  },
  modalButton: {
    flex: 1,
    padding: normalize(14),
    borderRadius: normalize(8),
    alignItems: 'center',
    justifyContent: 'center',
    height: normalize(50)
  },
  modalButtonCancel: {
    marginRight: normalize(8),
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e9ecef'
  },
  modalButtonCancelText: {
    color: '#555',
    fontSize: normalize(15),
    fontWeight: '600'
  },
  modalButtonSubmit: {
    marginLeft: normalize(8),
    backgroundColor: '#2196F3'
  },
  modalButtonSubmitText: {
    color: '#fff',
    fontSize: normalize(15),
    fontWeight: '600'
  }
});