import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  Dimensions,
  PixelRatio,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { FinanceContext } from '../context/FinanceContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 360;

function normalize(size) {
  const newSize = size * scale;
  if (Platform.OS === 'android') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

const STORAGE_CAREER = '@user_institutional_career';
const STORAGE_SCHEDULE = '@user_institutional_schedule';
const STORAGE_BIOMETRIC = '@user_biometric_enabled';

const CAREERS_UDB = [
  'Ingeniería en Ciencias de la Computación',
  'Técnico en Ingeniería en Computación',
  'Ingeniería Industrial',
  'Ingeniería Mecatrónica',
  'Ingeniería Biomédica',
  'Ingeniería Aeronáutica',
  'Licenciatura en Administración de Empresas',
  'Licenciatura en Diseño Gráfico',
  'Licenciatura en Idioma Inglés',
];

export default function ProfileScreen({ navigation }) {
  const { user, logout, resetPassword } = useContext(AuthContext);
  const { theme, isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { getMonthSummary, transactions = [] } = useContext(FinanceContext) || {};

  const [career, setCareer] = useState('');
  const [careerModalVisible, setCareerModalVisible] = useState(false);
  const [customCareer, setCustomCareer] = useState('');
  const [scheduleCount, setScheduleCount] = useState(0);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometría');

  const [cycle, setCycle] = useState('Ciclo 01');
  const [cycleModalVisible, setCycleModalVisible] = useState(false);
  const [customCycleInput, setCustomCycleInput] = useState('');

  const userCareerKey = user?.email ? `${STORAGE_CAREER}_${user.email}` : STORAGE_CAREER;
  const userScheduleKey = user?.email ? `${STORAGE_SCHEDULE}_${user.email}` : STORAGE_SCHEDULE;
  const userCycleKey = user?.email ? `@user_udb_cycle_${user.email}` : '@user_udb_cycle';

  const { balance = 0 } = getMonthSummary ? getMonthSummary(transactions) : {};

  // Cargar carrera, ciclo y conteo de materias desde almacenamiento local aislado
  useEffect(() => {
    // Resetear inmediatamente para evitar mostrar datos de cuenta previa
    setCareer('');
    setCycle('Ciclo 01');
    setScheduleCount(0);

    const loadAcademicData = async () => {
      try {
        const savedCareer = await AsyncStorage.getItem(userCareerKey);
        setCareer(savedCareer || '');

        const savedCycle = await AsyncStorage.getItem(userCycleKey);
        setCycle(savedCycle || 'Ciclo 01');

        const savedSchedule = await AsyncStorage.getItem(userScheduleKey);
        if (savedSchedule) {
          const parsed = JSON.parse(savedSchedule);
          if (Array.isArray(parsed)) {
            const uniqueMap = new Set(
              parsed.map((item) => (item.materia || '').trim().toLowerCase()).filter(Boolean)
            );
            setScheduleCount(uniqueMap.size);
          } else {
            setScheduleCount(0);
          }
        } else {
          setScheduleCount(0);
        }

        // Detección de biometría en el dispositivo
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (hasHardware && isEnrolled) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType('Face ID');
          } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricType('Huella Dactilar');
          }
        }

        const savedBio = await AsyncStorage.getItem(STORAGE_BIOMETRIC);
        if (savedBio === 'true') {
          setIsBiometricEnabled(true);
        } else {
          setIsBiometricEnabled(false);
        }
      } catch (e) {
        console.warn('Error cargando datos de perfil:', e);
      }
    };
    loadAcademicData();
  }, [userCareerKey, userScheduleKey, userCycleKey]);

  const handleToggleBiometrics = async (value) => {
    if (value) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) {
          Alert.alert(
            'Biometría no disponible',
            'Tu dispositivo no cuenta con biometría configurada o no tiene huellas/rostro registrados.'
          );
          return;
        }

        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: `Confirma tu identidad para habilitar ${biometricType}`,
          cancelLabel: 'Cancelar',
          disableDeviceFallback: false,
        });

        if (authResult.success) {
          setIsBiometricEnabled(true);
          await AsyncStorage.setItem(STORAGE_BIOMETRIC, 'true');
          Alert.alert('Seguridad Activada', `Acceso por ${biometricType} habilitado para esta cuenta.`);
        } else {
          setIsBiometricEnabled(false);
        }
      } catch (e) {
        Alert.alert('Error', 'No se pudo verificar la autenticación biométrica.');
      }
    } else {
      setIsBiometricEnabled(false);
      await AsyncStorage.setItem(STORAGE_BIOMETRIC, 'false');
    }
  };

  const handleSelectCareer = async (selected) => {
    setCareer(selected);
    setCareerModalVisible(false);
    try {
      await AsyncStorage.setItem(userCareerKey, selected);
      Alert.alert('Carrera Actualizada', `Tu carrera se ha configurado como: ${selected}`);
    } catch (e) {
      console.warn('Error guardando carrera:', e);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'UDB';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar tu sesión en FinanzasApp?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleResetPassword = () => {
    if (!user?.email) return;
    Alert.alert(
      'Restablecer Contraseña',
      `¿Deseas enviar un correo de restablecimiento a ${user.email}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar Correo',
          onPress: () => resetPassword(user.email),
        },
      ]
    );
  };

  const displayName = user?.displayName || 'Estudiante UDB';
  const email = user?.email || 'estudiante@udb.edu.sv';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── 1. CABECERA CON IDENTIDAD DEL ESTUDIANTE ── */}
      <View style={[styles.profileHeaderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.avatarWrap, { backgroundColor: '#2563EB' }]}>
          <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
        </View>

        <Text style={[styles.profileName, { color: theme.textPrimary }]}>
          {displayName}
        </Text>
        <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
          {email}
        </Text>

        <View style={styles.statusBadge}>
          <Ionicons name="school" size={normalize(13)} color="#2563EB" />
          <Text style={styles.statusBadgeText}>Estudiante Activo UDB</Text>
        </View>
      </View>

      {/* ── 2. INFORMACIÓN ACADÉMICA ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Información Académica</Text>
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => setCareerModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.infoIconCircle, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="book-outline" size={normalize(18)} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Carrera Universitaria</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              {career || 'Seleccionar carrera...'}
            </Text>
          </View>
          <Ionicons name="pencil-outline" size={normalize(16)} color="#2563EB" />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => {
            setCustomCycleInput(cycle);
            setCycleModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.infoIconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="school-outline" size={normalize(18)} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Ciclo Académico</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              {cycle || 'Configurar ciclo...'}
            </Text>
          </View>
          <Ionicons name="pencil-outline" size={normalize(16)} color="#2563EB" />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.infoRow}>
          <View style={[styles.infoIconCircle, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="location-outline" size={normalize(18)} color="#059669" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Campus</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              Campus Soyapango / Virtual
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => navigation.navigate('Horario')}
          activeOpacity={0.7}
        >
          <View style={[styles.infoIconCircle, { backgroundColor: '#F5F3FF' }]}>
            <Ionicons name="calendar-outline" size={normalize(18)} color="#7C3AED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Asignaturas Inscritas</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              {scheduleCount} {scheduleCount === 1 ? 'materia inscrita' : 'materias inscritas'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={normalize(16)} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── 3. RESUMEN FINANCIERO PERSONAL ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Resumen Financiero</Text>
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.infoRow}>
          <View style={[styles.infoIconCircle, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="wallet-outline" size={normalize(18)} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Balance Neto Actual</Text>
            <Text style={[styles.infoValue, { color: balance >= 0 ? '#10B981' : '#EF4444', fontWeight: '800' }]}>
              ${Number(balance).toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => navigation.navigate('Transacciones')}
          activeOpacity={0.7}
        >
          <View style={[styles.infoIconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="swap-horizontal-outline" size={normalize(18)} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Movimientos Registrados</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              {transactions.length} registros
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={normalize(16)} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── 4. PREFERENCIAS Y SISTEMA ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Preferencias de Aplicación</Text>
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.infoRow}>
          <View style={[styles.infoIconCircle, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
            <Ionicons
              name={isDarkMode ? 'moon' : 'sunny'}
              size={normalize(18)}
              color={isDarkMode ? '#FBBF24' : '#F59E0B'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Tema de Pantalla</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              {isDarkMode ? 'Modo Oscuro' : 'Modo Claro'}
            </Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.infoRow}>
          <View style={[styles.infoIconCircle, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="cloud-done-outline" size={normalize(18)} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Sincronización en la Nube</Text>
            <Text style={[styles.infoValue, { color: '#10B981', fontWeight: '700' }]}>
              Firebase Firestore Conectado
            </Text>
          </View>
        </View>
      </View>

      {/* ── 5. SEGURIDAD Y CUENTA ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Seguridad</Text>
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {/* Desbloqueo Biométrico */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIconCircle, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="finger-print-outline" size={normalize(18)} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Bloqueo de Seguridad</Text>
            <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
              {biometricType} ({isBiometricEnabled ? 'Activado' : 'Desactivado'})
            </Text>
          </View>
          <Switch
            value={isBiometricEnabled}
            onValueChange={handleToggleBiometrics}
            trackColor={{ false: '#CBD5E1', true: '#16A34A' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <TouchableOpacity
          style={styles.infoRow}
          onPress={handleResetPassword}
          activeOpacity={0.7}
        >
          <View style={[styles.infoIconCircle, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="key-outline" size={normalize(18)} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Seguridad de Acceso</Text>
            <Text style={[styles.infoValue, { color: '#2563EB', fontWeight: '700' }]}>
              Restablecer Contraseña por Email
            </Text>
          </View>
          <Ionicons name="mail-outline" size={normalize(18)} color="#2563EB" />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <TouchableOpacity
          style={styles.infoRow}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View style={[styles.infoIconCircle, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="log-out-outline" size={normalize(18)} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Sesión</Text>
            <Text style={[styles.infoValue, { color: '#EF4444', fontWeight: '700' }]}>
              Cerrar Sesión
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={normalize(16)} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* ── 6. PIE DE PÁGINA INFORMATIVO ── */}
      <View style={styles.footerContainer}>
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          FinanzasApp Institucional UDB
        </Text>
        <Text style={[styles.footerVersion, { color: theme.textSecondary }]}>
          Versión 1.0.0 • Universidad Don Bosco
        </Text>
      </View>

      {/* ── MODAL: SELECCIÓN DE CARRERA ── */}
      <Modal
        visible={careerModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCareerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: theme.textPrimary }]}>
                Selecciona tu Carrera UDB
              </Text>
              <TouchableOpacity onPress={() => setCareerModalVisible(false)}>
                <Ionicons name="close" size={normalize(22)} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: normalize(320) }}>
              {CAREERS_UDB.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.careerSelectItem,
                    {
                      borderColor: theme.border,
                      backgroundColor: career === c ? (isDarkMode ? '#1E3A8A' : '#EFF6FF') : 'transparent',
                    },
                  ]}
                  onPress={() => handleSelectCareer(c)}
                >
                  <Text
                    style={[
                      styles.careerSelectText,
                      { color: career === c ? '#2563EB' : theme.textPrimary, fontWeight: career === c ? '700' : '500' },
                    ]}
                  >
                    {c}
                  </Text>
                  {career === c && <Ionicons name="checkmark-circle" size={normalize(18)} color="#2563EB" />}
                </TouchableOpacity>
              ))}

              <Text style={[styles.customCareerLabel, { color: theme.textPrimary }]}>
                ¿Otra carrera o especialidad?
              </Text>
              <View style={{ flexDirection: 'row', gap: normalize(8), marginTop: normalize(6) }}>
                <TextInput
                  style={[
                    styles.customCareerInput,
                    { backgroundColor: theme.background, borderColor: theme.border, color: theme.textPrimary },
                  ]}
                  placeholder="Escribe tu carrera..."
                  placeholderTextColor={theme.textSecondary}
                  value={customCareer}
                  onChangeText={setCustomCareer}
                />
                <TouchableOpacity
                  style={styles.customCareerBtn}
                  onPress={() => {
                    if (customCareer.trim()) {
                      handleSelectCareer(customCareer.trim());
                    }
                  }}
                >
                  <Text style={styles.customCareerBtnText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: SELECCIÓN / EDICIÓN DE CICLO ── */}
      <Modal
        visible={cycleModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCycleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: theme.textPrimary }]}>
                Configura tu Ciclo Académico
              </Text>
              <TouchableOpacity onPress={() => setCycleModalVisible(false)}>
                <Ionicons name="close" size={normalize(22)} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: normalize(320) }}>
              {['Ciclo 01', 'Ciclo 02', 'Interciclo'].map((cItem, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.careerSelectItem,
                    {
                      borderColor: theme.border,
                      backgroundColor: cycle === cItem ? (isDarkMode ? '#1E3A8A' : '#EFF6FF') : 'transparent',
                    },
                  ]}
                  onPress={async () => {
                    setCycle(cItem);
                    setCycleModalVisible(false);
                    try {
                      await AsyncStorage.setItem(userCycleKey, cItem);
                    } catch (e) {
                      console.warn('Error guardando ciclo:', e);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.careerSelectText,
                      { color: cycle === cItem ? '#2563EB' : theme.textPrimary, fontWeight: cycle === cItem ? '700' : '500' },
                    ]}
                  >
                    {cItem}
                  </Text>
                  {cycle === cItem && <Ionicons name="checkmark-circle" size={normalize(18)} color="#2563EB" />}
                </TouchableOpacity>
              ))}

              <Text style={[styles.customCareerLabel, { color: theme.textPrimary }]}>
                O escribe tu ciclo personalizado:
              </Text>
              <View style={{ flexDirection: 'row', gap: normalize(8), marginTop: normalize(6) }}>
                <TextInput
                  style={[
                    styles.customCareerInput,
                    { backgroundColor: theme.background, borderColor: theme.border, color: theme.textPrimary },
                  ]}
                  placeholder="Ej. Ciclo 01-2026, Ciclo Par..."
                  placeholderTextColor={theme.textSecondary}
                  value={customCycleInput}
                  onChangeText={setCustomCycleInput}
                />
                <TouchableOpacity
                  style={styles.customCareerBtn}
                  onPress={async () => {
                    const trimmed = customCycleInput.trim();
                    if (trimmed) {
                      setCycle(trimmed);
                      setCycleModalVisible(false);
                      try {
                        await AsyncStorage.setItem(userCycleKey, trimmed);
                      } catch (e) {
                        console.warn('Error guardando ciclo:', e);
                      }
                    }
                  }}
                >
                  <Text style={styles.customCareerBtnText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: normalize(14),
    paddingTop: normalize(12),
    paddingBottom: normalize(36),
  },
  profileHeaderCard: {
    borderRadius: normalize(16),
    borderWidth: 1,
    padding: normalize(20),
    alignItems: 'center',
    marginBottom: normalize(14),
  },
  avatarWrap: {
    width: normalize(72),
    height: normalize(72),
    borderRadius: normalize(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(10),
    elevation: 3,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: normalize(26),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: normalize(18),
    fontWeight: '800',
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: normalize(12),
    marginTop: normalize(2),
    textAlign: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(5),
    borderRadius: normalize(12),
    marginTop: normalize(10),
    gap: normalize(6),
  },
  statusBadgeText: {
    color: '#1D4ED8',
    fontSize: normalize(11),
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: normalize(10),
    marginBottom: normalize(6),
    paddingHorizontal: normalize(4),
  },
  sectionTitle: {
    fontSize: normalize(14),
    fontWeight: '800',
  },
  infoCard: {
    borderRadius: normalize(14),
    borderWidth: 1,
    paddingHorizontal: normalize(14),
    paddingVertical: normalize(4),
    marginBottom: normalize(10),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: normalize(10),
    gap: normalize(10),
  },
  infoIconCircle: {
    width: normalize(34),
    height: normalize(34),
    borderRadius: normalize(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: normalize(11),
  },
  infoValue: {
    fontSize: normalize(13),
    fontWeight: '600',
    marginTop: normalize(1),
  },
  divider: {
    height: 1,
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: normalize(16),
    marginBottom: normalize(10),
  },
  footerText: {
    fontSize: normalize(11),
    fontWeight: '600',
  },
  footerVersion: {
    fontSize: normalize(10),
    marginTop: normalize(2),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: normalize(20),
    borderTopRightRadius: normalize(20),
    padding: normalize(18),
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(14),
  },
  modalTitleText: {
    fontSize: normalize(16),
    fontWeight: '800',
  },
  careerSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(12),
    borderRadius: normalize(10),
    borderWidth: 1,
    marginBottom: normalize(8),
  },
  careerSelectText: {
    fontSize: normalize(13),
    flex: 1,
    marginRight: normalize(8),
  },
  customCareerLabel: {
    fontSize: normalize(12),
    fontWeight: '700',
    marginTop: normalize(12),
  },
  customCareerInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: normalize(8),
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(8),
    fontSize: normalize(13),
  },
  customCareerBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: normalize(14),
    justifyContent: 'center',
    borderRadius: normalize(8),
  },
  customCareerBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: normalize(12),
  },
});
