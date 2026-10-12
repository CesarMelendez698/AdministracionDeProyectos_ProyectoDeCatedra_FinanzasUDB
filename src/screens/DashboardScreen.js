import React, { useContext, useLayoutEffect, useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  PixelRatio, 
  Platform, 
  Alert 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FinanceContext } from '../context/FinanceContext';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { PieChart } from 'react-native-chart-kit';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 360; 

function normalize(size) {
  const newSize = size * scale;
  if (Platform.OS === 'android') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

const WEEKDAY_KEYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function timeStringToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = (match[3] || '').toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatClassCountdown(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return 'EN BREVE';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours >= 1) {
    if (mins === 0) {
      return `EN ${hours} ${hours === 1 ? 'HORA' : 'HORAS'}`;
    }
    return `EN ${hours} ${hours === 1 ? 'HORA' : 'HORAS'} Y ${mins} MIN`;
  }
  return `EN ${mins} ${mins === 1 ? 'MINUTO' : 'MINUTOS'}`;
}

export default function DashboardScreen({ navigation }) {
  const { logout, user } = useContext(AuthContext);
  const { getMonthSummary, getAccountBalances, transactions = [] } = useContext(FinanceContext) || {};
  const { theme, isDarkMode, toggleTheme } = useContext(ThemeContext);

  // 1. Estado de Privacidad del Saldo
  const [showBalance, setShowBalance] = useState(true);

  // 2. Estado de la Próxima Clase del Día
  const [nextClassInfo, setNextClassInfo] = useState(null);

  useEffect(() => {
    const loadPrivacySetting = async () => {
      try {
        const saved = await AsyncStorage.getItem('@user_balance_privacy');
        if (saved !== null) {
          setShowBalance(saved === 'true');
        }
      } catch (e) {
        console.warn('Error leyendo preferencia de privacidad:', e);
      }
    };
    loadPrivacySetting();
  }, []);

  const toggleBalancePrivacy = async () => {
    const newValue = !showBalance;
    setShowBalance(newValue);
    try {
      await AsyncStorage.setItem('@user_balance_privacy', String(newValue));
    } catch (e) {
      console.warn('Error guardando privacidad:', e);
    }
  };

  // Cargar próxima clase del día en tiempo real
  useEffect(() => {
    const checkNextClass = async () => {
      try {
        const scheduleKey = user?.email ? `@user_institutional_schedule_${user.email}` : '@user_institutional_schedule';
        const saved = await AsyncStorage.getItem(scheduleKey);
        if (!saved) {
          setNextClassInfo(null);
          return;
        }

        const schedule = JSON.parse(saved);
        if (!Array.isArray(schedule) || schedule.length === 0) {
          setNextClassInfo(null);
          return;
        }

        const now = new Date();
        const currentDayKey = WEEKDAY_KEYS[now.getDay()];
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Filtrar clases de hoy
        const todayClasses = schedule
          .filter((item) => (item.dias || []).includes(currentDayKey))
          .sort((a, b) => timeStringToMinutes(a.horaInicio) - timeStringToMinutes(b.horaInicio));

        if (todayClasses.length === 0) {
          setNextClassInfo({ status: 'no_classes_today' });
          return;
        }

        // Buscar si hay alguna clase en curso o próxima
        let found = null;
        for (const c of todayClasses) {
          const startMin = timeStringToMinutes(c.horaInicio);
          const endMin = timeStringToMinutes(c.horaFin);

          if (currentMinutes >= startMin && currentMinutes < endMin) {
            found = { ...c, status: 'ongoing', timeDiff: endMin - currentMinutes };
            break;
          } else if (currentMinutes < startMin) {
            found = { ...c, status: 'upcoming', timeDiff: startMin - currentMinutes };
            break;
          }
        }

        if (found) {
          setNextClassInfo(found);
        } else {
          setNextClassInfo({ status: 'finished_today' });
        }
      } catch (e) {
        console.warn('Error calculando próxima clase:', e);
      }
    };

    checkNextClass();
    const interval = setInterval(checkNextClass, 60000); // Actualiza cada minuto
    return () => clearInterval(interval);
  }, [user]);

  const monthSummary = useMemo(() => {
    return getMonthSummary ? getMonthSummary(transactions) : { income: 0, expense: 0, balance: 0 };
  }, [getMonthSummary, transactions]);

  const { income = 0, expense = 0, balance = 0 } = monthSummary;

  const accountBalances = useMemo(() => {
    return getAccountBalances ? getAccountBalances() : [];
  }, [getAccountBalances]);

  // Paleta moderna adaptada al brillo del tema activo
  const chartData = useMemo(() => {
    const categoryTotals = {};
    for (let i = 0; i < (transactions || []).length; i++) {
      const t = transactions[i];
      if (t && t.type === 'expense' && t.category) {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Number(t.amount || 0);
      }
    }
    const colorPalette = ['#6366F1', '#10B981', '#F59E0B', '#06B6D4', '#EC4899'];
    return Object.keys(categoryTotals).map((cat, idx) => ({
      name: cat,
      population: categoryTotals[cat],
      color: colorPalette[idx % colorPalette.length],
      legendFontColor: theme.textSecondary,
      legendFontSize: normalize(11) 
    }));
  }, [transactions, theme.textSecondary]);

  const getShortName = (fullName) => {
    if (!fullName) return 'Estudiante UDB';
    const words = fullName.trim().split(/\s+/);
    if (words.length >= 3) return `${words[0]} ${words[2]}`;
    if (words.length === 2) return `${words[0]} ${words[1]}`;
    return words[0];
  };

  const rawName = user?.displayName ? user.displayName : (user?.email ? user.email.split('@')[0] : 'Estudiante UDB');
  const formattedUserGreeting = getShortName(rawName);

  const getInitials = (name) => {
    const parts = name.split(' ');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleLogoutPress = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', onPress: logout, style: 'destructive' },
      ],
      { cancelable: true }
    );
  };

  // Sincronización del Header nativo con los colores del tema persistido
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity
          style={styles.headerProfileCard}
          onPress={() => navigation.navigate('Perfil')}
          activeOpacity={0.7}
        >
          <View style={[styles.avatarCircle, { backgroundColor: theme.accent }]}>
            <Text style={styles.avatarText}>{getInitials(formattedUserGreeting)}</Text>
          </View>
          <View style={styles.profileInfoContainer}>
            <Text style={[styles.welcomeLabel, { color: theme.textSecondary }]}>Mi Cuenta UDB</Text>
            <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>{formattedUserGreeting}</Text>
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          {/* 👤 BOTÓN DIRECTO AL PERFIL */}
          <TouchableOpacity 
            style={[styles.headerIconTouch, { marginRight: normalize(4) }]} 
            onPress={() => navigation.navigate('Perfil')}
            activeOpacity={0.6}
          >
            <Ionicons 
              name="person-circle-outline" 
              size={normalize(22)} 
              color="#2196F3" 
            />
          </TouchableOpacity>

          {/* 🌓 SWITCH INTERACTIVO DE TEMA (MODO OSCURO / CLARO) */}
          <TouchableOpacity 
            style={[styles.headerIconTouch, { marginRight: normalize(4) }]} 
            onPress={toggleTheme}
            activeOpacity={0.6}
          >
            <Ionicons 
              name={isDarkMode ? "sun-outline" : "moon-outline"} 
              size={normalize(20)} 
              color={isDarkMode ? theme.warning : theme.textPrimary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerLogoutButton} 
            onPress={handleLogoutPress} 
            activeOpacity={0.6}
          >
            <Ionicons name="log-out-outline" size={normalize(20)} color={theme.danger} />
          </TouchableOpacity>
        </View>
      ),
      headerStyle: {
        height: Platform.OS === 'ios' ? normalize(100) : normalize(90), 
        backgroundColor: theme.card, // Fondo dinámico del Header
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      headerShadowVisible: false,
    });
  }, [navigation, formattedUserGreeting, theme, isDarkMode]);

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]} 
      showsVerticalScrollIndicator={false}
    >
      
      {/* 💳 CARD PREMIUM: BALANCE GENERAL NETO (CON MODO PRIVACIDAD) */}
      <View style={[styles.premiumCard, { backgroundColor: theme.premiumCard }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.premiumLabel, { color: theme.premiumText }]}>BALANCE NETO DISPONIBLE</Text>
          <TouchableOpacity 
            onPress={toggleBalancePrivacy} 
            activeOpacity={0.7}
            style={{ padding: normalize(4) }}
          >
            <Ionicons 
              name={showBalance ? "eye-outline" : "eye-off-outline"} 
              size={normalize(18)} 
              color={theme.premiumText} 
            />
          </TouchableOpacity>
        </View>

        <Text style={[styles.premiumBalance, { color: balance >= 0 ? theme.success : theme.danger }]}>
          {showBalance
            ? `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '$ • • • • • •'}
        </Text>
        
        <View style={styles.premiumRow}>
          <View style={styles.flowContainer}>
            <View style={[styles.indicatorDot, { backgroundColor: theme.success }]} />
            <View>
              <Text style={[styles.flowLabel, { color: theme.premiumText }]}>Ingresos</Text>
              <Text style={styles.flowValue}>
                {showBalance ? `$${income.toFixed(2)}` : '$ •••'}
              </Text>
            </View>
          </View>

          <View style={styles.flowContainer}>
            <View style={[styles.indicatorDot, { backgroundColor: theme.danger }]} />
            <View>
              <Text style={[styles.flowLabel, { color: theme.premiumText }]}>Gastos</Text>
              <Text style={styles.flowValue}>
                {showBalance ? `$${expense.toFixed(2)}` : '$ •••'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 🎓 WIDGET INTELIGENTE: PRÓXIMA CLASE DEL DÍA */}
      {nextClassInfo && nextClassInfo.status !== 'no_classes_today' ? (
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.nextClassWidget,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: nextClassInfo.status === 'ongoing' ? '#10B981' : theme.border,
            },
          ]}
          onPress={() => navigation.navigate('Horario')}
        >
          <View style={styles.nextClassTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: normalize(6) }}>
              <View
                style={[
                  styles.nextClassStatusDot,
                  { backgroundColor: nextClassInfo.status === 'ongoing' ? '#10B981' : '#2563EB' },
                ]}
              />
              <Text style={[styles.nextClassStatusText, { color: nextClassInfo.status === 'ongoing' ? '#10B981' : '#2563EB' }]}>
                {nextClassInfo.status === 'ongoing'
                  ? 'EN CURSO AHORA'
                  : nextClassInfo.status === 'upcoming'
                  ? formatClassCountdown(nextClassInfo.timeDiff)
                  : 'CLASES FINALIZADAS'}
              </Text>
            </View>

            <View style={styles.nextClassTimeBadge}>
              <Ionicons name="time-outline" size={normalize(12)} color="#1D4ED8" />
              <Text style={styles.nextClassTimeBadgeText}>
                {nextClassInfo.horaInicio ? `${nextClassInfo.horaInicio} - ${nextClassInfo.horaFin}` : 'Hoy'}
              </Text>
            </View>
          </View>

          <Text style={[styles.nextClassTitle, { color: theme.textPrimary }]} numberOfLines={1}>
            {nextClassInfo.materia || 'Jornada Universitaria Completada'}
          </Text>

          {nextClassInfo.materia ? (
            <View style={styles.nextClassBottomRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: normalize(4) }}>
                <Ionicons name="location-outline" size={normalize(13)} color={theme.textSecondary} />
                <Text style={[styles.nextClassDetail, { color: theme.textSecondary }]}>
                  {nextClassInfo.aula || 'Campus Virtual'}
                </Text>
              </View>

              {nextClassInfo.docente ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: normalize(4) }}>
                  <Ionicons name="person-outline" size={normalize(13)} color={theme.textSecondary} />
                  <Text style={[styles.nextClassDetail, { color: theme.textSecondary }]} numberOfLines={1}>
                    {nextClassInfo.docente}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.nextClassDetail, { color: theme.textSecondary, marginTop: normalize(2) }]}>
              ¡Has terminado todas tus clases de hoy! Descansa o revisa tus finanzas. 🎉
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      {/* 🎓 SECCIÓN: ACCESOS RÁPIDOS CAMPUS UDB */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Campus UDB</Text>
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Servicios institucionales</Text>
      </View>

      <View style={styles.quickServicesGrid}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.serviceCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => navigation.navigate('Horario')}
        >
          <View style={[styles.serviceIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="calendar" size={normalize(20)} color="#2563EB" />
          </View>
          <View style={styles.serviceTextWrap}>
            <Text style={[styles.serviceTitle, { color: theme.textPrimary }]}>Mi Horario</Text>
            <Text style={[styles.serviceDesc, { color: theme.textSecondary }]}>Asignaturas de la semana</Text>
          </View>
          <Ionicons name="chevron-forward" size={normalize(16)} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.serviceCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => navigation.navigate('Noticias')}
        >
          <View style={[styles.serviceIconWrap, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="newspaper" size={normalize(20)} color="#D97706" />
          </View>
          <View style={styles.serviceTextWrap}>
            <Text style={[styles.serviceTitle, { color: theme.textPrimary }]}>Noticias UDB</Text>
            <Text style={[styles.serviceDesc, { color: theme.textSecondary }]}>Boletín y comunicados</Text>
          </View>
          <Ionicons name="chevron-forward" size={normalize(16)} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.serviceCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => navigation.navigate('Perfil')}
        >
          <View style={[styles.serviceIconWrap, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="person-circle" size={normalize(20)} color="#059669" />
          </View>
          <View style={styles.serviceTextWrap}>
            <Text style={[styles.serviceTitle, { color: theme.textPrimary }]}>Mi Perfil</Text>
            <Text style={[styles.serviceDesc, { color: theme.textSecondary }]}>Datos, carrera y cuenta</Text>
          </View>
          <Ionicons name="chevron-forward" size={normalize(16)} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* 🏦 SECCIÓN: SALDOS DE CUENTAS */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Tus Cuentas y Saldos</Text>
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Distribución líquida actual</Text>
      </View>
      
      <View style={[styles.listCardContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {accountBalances.map((acc, index) => (
          <View 
            key={acc.id} 
            style={[
              styles.accountRow, 
              { borderColor: theme.border },
              index === accountBalances.length - 1 && { borderBottomWidth: 0 }
            ]}
          >
            <View style={styles.accountInfoLeft}>
              <View style={[styles.accountIconDummy, { backgroundColor: theme.background }]}>
                <Text style={styles.accountIconText}>💳</Text>
              </View>
              <Text style={[styles.accName, { color: theme.textPrimary }]}>{acc.name}</Text>
            </View>
            <Text style={[styles.accValue, { color: theme.textPrimary }]}>
              {showBalance ? `$${acc.balance.toFixed(2)}` : '$ •••'}
            </Text>
          </View>
        ))}
      </View>

      {/* 📊 SECCIÓN: GRÁFICO DE DISTRIBUCIÓN */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Distribución de Gastos</Text>
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Análisis proporcional por categorías</Text>
      </View>

      {chartData.length > 0 ? (
        <View style={[styles.chartBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <PieChart
            data={chartData}
            width={SCREEN_WIDTH - normalize(32)}
            height={normalize(180)}
            chartConfig={{
              color: (opacity = 1) => isDarkMode ? `rgba(248, 250, 252, ${opacity})` : `rgba(15, 23, 42, ${opacity})`,
            }}
            accessor={"population"}
            backgroundColor={"transparent"}
            paddingLeft={normalize(8)}
            absolute
          />
        </View>
      ) : (
        <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay gastos registrados en este período.</Text>
        </View>
      )}
      
      <View style={{ height: normalize(24) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: normalize(16) 
  },
  headerProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: SCREEN_WIDTH - normalize(140), 
  },
  avatarCircle: {
    width: normalize(36),
    height: normalize(36),
    borderRadius: normalize(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: normalize(8),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3
  },
  avatarText: {
    color: '#fff',
    fontSize: normalize(12),
    fontWeight: 'bold',
    letterSpacing: 0.5
  },
  profileInfoContainer: {
    justifyContent: 'center',
    flex: 1
  },
  welcomeLabel: {
    fontSize: normalize(9),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  userName: {
    fontSize: normalize(13),
    fontWeight: '700',
    marginTop: normalize(1),
    textTransform: 'capitalize'
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  headerIconTouch: {
    padding: normalize(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogoutButton: {
    paddingHorizontal: normalize(12),
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumCard: { 
    padding: normalize(20), 
    borderRadius: normalize(16), 
    marginBottom: normalize(24), 
    marginTop: normalize(8),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8
  },
  premiumLabel: { 
    fontSize: normalize(11), 
    fontWeight: '700',
    letterSpacing: 1
  },
  premiumBalance: { 
    fontSize: normalize(30), 
    fontWeight: '800', 
    marginVertical: normalize(8),
    letterSpacing: -0.5
  },
  premiumRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: normalize(14),
    paddingTop: normalize(14),
    borderTopWidth: 1,
    borderColor: '#334155'
  },
  flowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%'
  },
  indicatorDot: {
    width: normalize(8),
    height: normalize(8),
    borderRadius: normalize(4),
    marginRight: normalize(8)
  },
  flowLabel: { 
    fontSize: normalize(11), 
    fontWeight: '500'
  },
  flowValue: { 
    fontSize: normalize(14), 
    fontWeight: '600', 
    color: '#F8FAFC',
    marginTop: normalize(1)
  },
  sectionHeader: {
    marginBottom: normalize(10),
    marginTop: normalize(4)
  },
  sectionTitle: { 
    fontSize: normalize(16), 
    fontWeight: '700', 
  },
  sectionSubtitle: {
    fontSize: normalize(12),
    marginTop: normalize(1)
  },
  listCardContainer: {
    borderRadius: normalize(12),
    borderWidth: 1,
    marginBottom: normalize(24),
    overflow: 'hidden'
  },
  accountRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: normalize(16), 
    borderBottomWidth: 1, 
  },
  accountInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  accountIconDummy: {
    width: normalize(32),
    height: normalize(32),
    borderRadius: normalize(8),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: normalize(12)
  },
  accountIconText: {
    fontSize: normalize(16)
  },
  accName: { 
    fontSize: normalize(14), 
    fontWeight: '500',
  },
  accValue: { 
    fontSize: normalize(14), 
    fontWeight: '700', 
  },
  chartBox: { 
    borderRadius: normalize(12), 
    paddingVertical: normalize(16), 
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: normalize(24),
    justifyContent: 'center'
  },
  emptyBox: {
    borderRadius: normalize(12),
    padding: normalize(24),
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: normalize(24)
  },
  emptyText: { 
    textAlign: 'center', 
    fontSize: normalize(13),
    fontStyle: 'italic' 
  },
  quickServicesGrid: {
    gap: normalize(10),
    marginBottom: normalize(20),
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: normalize(12),
    borderRadius: normalize(12),
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  serviceIconWrap: {
    width: normalize(40),
    height: normalize(40),
    borderRadius: normalize(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: normalize(12),
  },
  serviceTextWrap: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: normalize(14),
    fontWeight: '700',
    marginBottom: normalize(2),
  },
  serviceDesc: {
    fontSize: normalize(11),
    fontWeight: '500',
  },
  nextClassWidget: {
    marginHorizontal: normalize(16),
    marginTop: normalize(12),
    marginBottom: normalize(4),
    padding: normalize(14),
    borderRadius: normalize(14),
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  nextClassTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(6),
  },
  nextClassStatusDot: {
    width: normalize(7),
    height: normalize(7),
    borderRadius: normalize(4),
  },
  nextClassStatusText: {
    fontSize: normalize(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  nextClassTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(3),
    borderRadius: normalize(6),
    gap: normalize(4),
  },
  nextClassTimeBadgeText: {
    fontSize: normalize(10),
    fontWeight: '700',
    color: '#1D4ED8',
  },
  nextClassTitle: {
    fontSize: normalize(15),
    fontWeight: '700',
    marginBottom: normalize(6),
  },
  nextClassBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(12),
  },
  nextClassDetail: {
    fontSize: normalize(11),
    fontWeight: '500',
  },
});