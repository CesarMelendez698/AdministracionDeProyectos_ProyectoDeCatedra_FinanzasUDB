import React, { useState, useContext, useMemo, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  Alert, 
  ScrollView,
  Dimensions,
  PixelRatio,
  Platform,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FinanceContext } from '../context/FinanceContext';
import { ThemeContext } from '../context/ThemeContext'; 
import { AuthContext } from '../context/AuthContext';
import BudgetProgressBar from '../components/BudgetProgressBar';

// --- CONFIGURACIÓN DE RESPONSIVIDAD DINÁMICA ---
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 360; 

function normalize(size) {
  const newSize = size * scale;
  if (Platform.OS === 'android') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

const STORAGE_CYCLE_KEY = '@user_udb_cycle';

export default function BudgetsScreen() {
  const { user } = useContext(AuthContext);
  const { 
    budgets = [], 
    transactions = [], 
    allCategories = [], 
    addBudget, 
    deleteBudget 
  } = useContext(FinanceContext) || {};
  
  const { theme, isDarkMode } = useContext(ThemeContext) || {};
  
  // Pestaña activa: Presupuestos de gastos vs Cuotas Universitarias UDB
  const [activeTab, setActiveTab] = useState('budgets'); // 'budgets' | 'fees'

  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('');
  const [isLimitFocused, setIsLimitFocused] = useState(false);

  // Estado para Cuotas Universitarias UDB (empieza vacío para nuevas cuentas)
  const [udbFees, setUdbFees] = useState([]);
  const userFeesKey = user?.email ? `@user_udb_fees_${user.email}` : '@user_udb_fees';

  // Estado y almacenamiento para el Ciclo Académico (editable por el usuario)
  const userCycleKey = user?.email ? `${STORAGE_CYCLE_KEY}_${user.email}` : STORAGE_CYCLE_KEY;
  const [currentCycle, setCurrentCycle] = useState('Ciclo 01');
  const [cycleModalVisible, setCycleModalVisible] = useState(false);
  const [inputCycle, setInputCycle] = useState('');

  // Estados para Anotar / Editar Cuota Manualmente
  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState(null);
  const [formFeeTitle, setFormFeeTitle] = useState('');
  const [formFeeAmount, setFormFeeAmount] = useState('');
  const [formFeeDeadline, setFormFeeDeadline] = useState('');
  const [formFeeStatus, setFormFeeStatus] = useState('pending'); // 'pending' | 'paid'
  const [showFeeDatePicker, setShowFeeDatePicker] = useState(false);
  const [feeDateObject, setFeeDateObject] = useState(new Date());

  const onFeeDateChange = (event, selectedDate) => {
    setShowFeeDatePicker(false);
    if (event.type === 'dismissed') {
      return;
    }
    if (selectedDate) {
      setFeeDateObject(selectedDate);
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = selectedDate.getFullYear();
      setFormFeeDeadline(`${day}-${month}-${year}`);
    }
  };

  useEffect(() => {
    // Resetear inmediatamente al cambiar de usuario
    setUdbFees([]);
    const loadFeesAndCycle = async () => {
      try {
        const savedCycle = await AsyncStorage.getItem(userCycleKey);
        if (savedCycle) {
          setCurrentCycle(savedCycle);
        } else {
          setCurrentCycle('Ciclo 01');
        }

        const saved = await AsyncStorage.getItem(userFeesKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setUdbFees(parsed);
            return;
          }
        }
        setUdbFees([]);
      } catch (e) {
        console.warn('Error leyendo cuotas y ciclo:', e);
      }
    };
    loadFeesAndCycle();
  }, [userFeesKey, userCycleKey]);

  const saveCycle = async (newCycle) => {
    const trimmed = (newCycle || '').trim() || 'Ciclo 01';
    setCurrentCycle(trimmed);
    setCycleModalVisible(false);
    try {
      await AsyncStorage.setItem(userCycleKey, trimmed);
    } catch (e) {
      console.warn('Error guardando ciclo:', e);
    }
  };

  const saveFees = async (newFees) => {
    setUdbFees(newFees);
    try {
      await AsyncStorage.setItem(userFeesKey, JSON.stringify(newFees));
    } catch (e) {
      console.warn('Error guardando cuotas:', e);
    }
  };

  const handleOpenAddFee = () => {
    setEditingFeeId(null);
    setFormFeeTitle('');
    setFormFeeAmount('');
    const today = new Date();
    setFeeDateObject(today);
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    setFormFeeDeadline(`${day}-${month}-${year}`);
    setFormFeeStatus('pending');
    setShowFeeDatePicker(false);
    setFeeModalVisible(true);
  };

  const handleOpenEditFee = (fee) => {
    setEditingFeeId(fee.id);
    setFormFeeTitle(fee.title || '');
    setFormFeeAmount(fee.amount ? String(fee.amount) : '');
    const deadlineVal = fee.deadline || fee.dueDate || '';
    setFormFeeDeadline(deadlineVal);
    if (deadlineVal) {
      let parsed = null;
      if (deadlineVal.includes('-')) {
        const parts = deadlineVal.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            parsed = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          } else {
            parsed = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          }
        }
      }
      setFeeDateObject(parsed && !isNaN(parsed.getTime()) ? parsed : new Date());
    } else {
      setFeeDateObject(new Date());
    }
    setFormFeeStatus(fee.status || 'pending');
    setShowFeeDatePicker(false);
    setFeeModalVisible(true);
  };

  const handleSaveFee = () => {
    const cleanTitle = formFeeTitle.trim();
    const cleanAmountStr = formFeeAmount.trim().replace(',', '.');
    const parsedAmount = parseFloat(cleanAmountStr);

    if (!cleanTitle) {
      Alert.alert('Falta Información', 'Ingresa el nombre o concepto de la cuota.');
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Monto Inválido', 'Ingresa un monto numérico mayor a 0.');
      return;
    }

    const cleanDeadline = formFeeDeadline.trim() || 'Sin fecha límite';

    if (editingFeeId) {
      // Editar existente
      const updated = udbFees.map((f) => {
        if (f.id === editingFeeId) {
          return {
            ...f,
            title: cleanTitle,
            amount: parsedAmount,
            deadline: cleanDeadline,
            status: formFeeStatus,
          };
        }
        return f;
      });
      saveFees(updated);
      Alert.alert('Cuota Actualizada', 'Los datos de la cuota fueron guardados.');
    } else {
      // Crear nueva cuota
      const newFeeItem = {
        id: `fee_${Date.now()}`,
        title: cleanTitle,
        amount: parsedAmount,
        deadline: cleanDeadline,
        status: formFeeStatus,
      };
      saveFees([...udbFees, newFeeItem]);
      Alert.alert('Cuota Anotada', 'La nueva cuota fue registrada con éxito.');
    }

    setFeeModalVisible(false);
  };

  const handleDeleteFee = (feeId, feeTitle) => {
    Alert.alert(
      'Eliminar Cuota',
      `¿Deseas eliminar la cuota "${feeTitle}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const filtered = udbFees.filter((f) => f.id !== feeId);
            saveFees(filtered);
          },
        },
      ]
    );
  };

  const handleToggleFeeStatus = (feeId) => {
    const updated = udbFees.map((f) => {
      if (f.id === feeId) {
        const nextStatus = f.status === 'paid' ? 'pending' : 'paid';
        return { ...f, status: nextStatus };
      }
      return f;
    });
    saveFees(updated);
  };

  // OPTIMIZACIÓN: Pre-calcular los gastos mensuales agrupados por categoría
  const spentByCategory = useMemo(() => {
    const currentYearMonth = new Date().toISOString().slice(0, 7); 
    const totals = {};

    transactions.forEach(t => {
      if (
        t && 
        t.type === 'expense' && 
        t.category && 
        t.date && 
        t.date.startsWith(currentYearMonth)
      ) {
        const catKey = t.category.trim().toLowerCase();
        const amount = Number(t.amount || 0);
        totals[catKey] = (totals[catKey] || 0) + amount;
      }
    });

    return totals;
  }, [transactions]);

  const handleSave = async () => {
    const cleanCategory = category.trim();
    const cleanLimit = limit.trim().replace(',', '.');

    if (!cleanCategory || !cleanLimit) {
      Alert.alert('Incompleto', 'Selecciona una categoría e ingresa el límite mensual.');
      return;
    }

    const categoryExists = allCategories.some(
      cat => cat.trim().toLowerCase() === cleanCategory.toLowerCase()
    );

    if (!categoryExists) {
      Alert.alert('Categoría No Permitida', 'Solo puedes asignar presupuestos a las categorías existentes.');
      return;
    }

    const budgetAlreadyExists = budgets.some(
      b => b.category && b.category.trim().toLowerCase() === cleanCategory.toLowerCase()
    );

    if (budgetAlreadyExists) {
      Alert.alert('Presupuesto Duplicado', `Ya definiste un límite para "${cleanCategory}".`);
      return;
    }

    const numericLimit = Number(cleanLimit);
    if (isNaN(numericLimit) || numericLimit <= 0) {
      Alert.alert('Monto Inválido', 'Por favor, ingresa un límite numérico mayor a cero.');
      return;
    }

    // ⚡ RESPUESTA INSTANTÁNEA: Limpieza inmediata del formulario y actualización optimista
    setCategory('');
    setLimit('');
    addBudget(cleanCategory, cleanLimit);
  };

  const handleDelete = (id, categoryName) => {
    Alert.alert(
      'Eliminar Presupuesto',
      `¿Deseas quitar el límite de gastos mensual para "${categoryName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive', 
          onPress: () => {
            deleteBudget(id); // Desaparece inmediatamente de la UI
          } 
        }
      ]
    );
  };

  const feesSummary = useMemo(() => {
    let paidTotal = 0;
    let pendingTotal = 0;
    let paidCount = 0;
    udbFees.forEach((f) => {
      if (f.status === 'paid') {
        paidTotal += Number(f.amount || 0);
        paidCount++;
      } else {
        pendingTotal += Number(f.amount || 0);
      }
    });
    return { paidTotal, pendingTotal, paidCount, totalCount: udbFees.length };
  }, [udbFees]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* SELECTOR SEGMENTADO */}
      <View style={[styles.tabSegmentContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
        <TouchableOpacity
          style={[
            styles.tabSegmentBtn,
            activeTab === 'budgets' && [styles.tabSegmentBtnActive, { backgroundColor: theme.card }]
          ]}
          onPress={() => setActiveTab('budgets')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="pie-chart-outline" 
            size={normalize(15)} 
            color={activeTab === 'budgets' ? theme.accent : theme.textSecondary} 
            style={{ marginRight: 6 }} 
          />
          <Text style={[
            styles.tabSegmentText,
            { color: theme.textSecondary },
            activeTab === 'budgets' && { color: theme.textPrimary, fontWeight: '700' }
          ]}>
            Límites de Gastos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabSegmentBtn,
            activeTab === 'fees' && [styles.tabSegmentBtnActive, { backgroundColor: theme.card }]
          ]}
          onPress={() => setActiveTab('fees')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="school-outline" 
            size={normalize(15)} 
            color={activeTab === 'fees' ? theme.accent : theme.textSecondary} 
            style={{ marginRight: 6 }} 
          />
          <Text style={[
            styles.tabSegmentText,
            { color: theme.textSecondary },
            activeTab === 'fees' && { color: theme.textPrimary, fontWeight: '700' }
          ]}>
            Cuotas UDB 🎓
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'budgets' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* SECCIÓN CREAR / CONFIGURAR */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Configurar Límite Mensual</Text>
            
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Categoría seleccionada</Text>
            <View style={[
              styles.customSelectTrigger, 
              { backgroundColor: isDarkMode ? '#0F172A' : '#F0F2F5', borderColor: theme.border },
              category !== '' && { borderColor: theme.accent, borderWidth: 1.5, backgroundColor: theme.card }
            ]}>
              <Text style={[
                styles.selectTriggerText, 
                { color: theme.textSecondary },
                category !== '' && { color: theme.textPrimary, fontWeight: '500' }
              ]} numberOfLines={1}>
                {category || 'Toca una categoría de la lista de abajo'}
              </Text>
            </View>

            <Text style={[styles.lblMini, { color: theme.textSecondary }]}>Categorías disponibles</Text>
            <View style={styles.scrollChipsWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                {allCategories.map((cat, index) => {
                  const isSelected = category.trim().toLowerCase() === cat.trim().toLowerCase();
                  return (
                    <TouchableOpacity 
                      key={index} 
                      style={[
                        styles.chip, 
                        { backgroundColor: isDarkMode ? '#1E293B' : '#F0F2F5', borderColor: theme.border },
                        isSelected && { backgroundColor: theme.accent, borderColor: theme.accent }
                      ]} 
                      onPress={() => setCategory(cat)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.chipText, 
                        { color: isDarkMode ? '#94A3B8' : '#486581' },
                        isSelected && styles.textWhite
                      ]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Monto del presupuesto</Text>
            <View style={[
              styles.currencyInputContainer, 
              { backgroundColor: isDarkMode ? '#0F172A' : '#F0F2F5', borderColor: theme.border },
              (limit !== '' || isLimitFocused) && { borderColor: theme.accent, borderWidth: 1.5, backgroundColor: theme.card }
            ]}>
              <Text style={[
                styles.currencySymbol, 
                { color: theme.textPrimary }, 
                (limit !== '' || isLimitFocused) && { color: theme.accent }
              ]}>$</Text>
              <TextInput 
                style={[styles.currencyInput, { color: theme.textPrimary }]} 
                placeholder="0.00" 
                keyboardType="decimal-pad" 
                value={limit} 
                onChangeText={setLimit} 
                placeholderTextColor={isDarkMode ? '#475569' : '#94A3B8'}
                onFocus={() => setIsLimitFocused(true)}
                onBlur={() => setIsLimitFocused(false)}
              />
            </View>
            
            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.accent }]} onPress={handleSave} activeOpacity={0.9}>
              <Text style={styles.btnText}>Establecer Presupuesto</Text>
            </TouchableOpacity>
          </View>

          {/* SECCIÓN LISTADO / CONTROL */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Estado de Presupuestos</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Límites asignados y consumo del mes actual</Text>
          </View>
          
          <View style={[
            styles.listContainerStyle, 
            { backgroundColor: theme.card, borderColor: theme.border },
            budgets.length === 0 && { backgroundColor: 'transparent', borderWidth: 0 }
          ]}>
            {budgets.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.empty, { color: theme.textSecondary }]}>No has definido presupuestos para este período.</Text>
              </View>
            ) : (
              budgets.map((item) => {
                const catKey = item.category ? item.category.trim().toLowerCase() : '';
                const spent = spentByCategory[catKey] || 0;

                return (
                  <View key={item.id} style={[styles.budgetListItem, { borderColor: theme.border }]}>
                    <View style={styles.budgetMainRow}>
                      <View style={{ flex: 1, paddingRight: normalize(4) }}>
                        <BudgetProgressBar 
                          category={item.category} 
                          spent={spent} 
                          limit={Number(item.monthlyLimit || 0)} 
                        />
                      </View>
                      
                      <TouchableOpacity 
                        style={[
                          styles.rowDeleteBtn, 
                          isDarkMode && { backgroundColor: '#311C1C', borderColor: '#552222' }
                        ]}
                        onPress={() => handleDelete(item.id, item.category)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.rowDeleteBtnText, isDarkMode && { color: '#F87171' }]}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* RESUMEN ARANCELES UDB */}
          <View style={[styles.feeSummaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.feeSummaryHeader}>
              <View>
                <Text style={[styles.feeSummaryTitle, { color: theme.textPrimary }]}>Aranceles del Ciclo (UDB)</Text>
                <Text style={[styles.feeSummarySubtitle, { color: theme.textSecondary }]}>
                  Progreso: {feesSummary.paidCount} de {feesSummary.totalCount} pagados
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.badgeCycle, { backgroundColor: isDarkMode ? '#1E293B' : '#E0E7FF' }]}
                onPress={() => {
                  setInputCycle(currentCycle);
                  setCycleModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={normalize(12)} color={theme.accent} style={{ marginRight: 4 }} />
                <Text style={[styles.badgeCycleText, { color: theme.accent }]}>{currentCycle || 'Ciclo 01'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.feeSummaryGrid}>
              <View style={[styles.feeMetricBox, { backgroundColor: isDarkMode ? '#064E3B20' : '#ECFDF5', borderColor: '#10B98130' }]}>
                <Text style={styles.feeMetricLabel}>Total Pagado</Text>
                <Text style={[styles.feeMetricValue, { color: '#10B981' }]}>${feesSummary.paidTotal.toFixed(2)}</Text>
              </View>

              <View style={[styles.feeMetricBox, { backgroundColor: isDarkMode ? '#451A0320' : '#FFFBEB', borderColor: '#F59E0B30' }]}>
                <Text style={styles.feeMetricLabel}>Pendiente</Text>
                <Text style={[styles.feeMetricValue, { color: '#F59E0B' }]}>${feesSummary.pendingTotal.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* LISTA DE CUOTAS */}
          <View style={styles.feeSectionHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Calendario de Pagos</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                {udbFees.length} {udbFees.length === 1 ? 'cuota registrada' : 'cuotas registradas'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btnAddFeeHeader, { backgroundColor: theme.accent }]}
              onPress={handleOpenAddFee}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={normalize(16)} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.btnAddFeeHeaderText}>+ Anotar Cuota</Text>
            </TouchableOpacity>
          </View>

          {udbFees.length === 0 ? (
            <View style={[styles.emptyFeeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="school-outline" size={normalize(38)} color={theme.textSecondary} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptyFeeTitle, { color: theme.textPrimary }]}>No tienes cuotas anotadas</Text>
              <Text style={[styles.emptyFeeSubtitle, { color: theme.textSecondary }]}>
                Anota manualmente las mensualidades, matrículas o aranceles de tu ciclo.
              </Text>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: theme.accent, marginTop: normalize(14) }]}
                onPress={handleOpenAddFee}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>+ Anotar Primera Cuota</Text>
              </TouchableOpacity>
            </View>
          ) : (
            udbFees.map((fee) => {
              const isPaid = fee.status === 'paid';
              return (
                <View 
                  key={fee.id} 
                  style={[
                    styles.feeCard, 
                    { backgroundColor: theme.card, borderColor: theme.border },
                    isPaid && { borderColor: '#10B98150' }
                  ]}
                >
                  <View style={styles.feeCardLeft}>
                    <TouchableOpacity
                      onPress={() => handleToggleFeeStatus(fee.id)}
                      activeOpacity={0.7}
                      style={[
                        styles.feeIconCircle, 
                        { backgroundColor: isPaid ? (isDarkMode ? '#064E3B40' : '#D1FAE5') : (isDarkMode ? '#1E293B' : '#F1F5F9') }
                      ]}
                    >
                      <Ionicons 
                        name={isPaid ? "checkmark-circle" : "time-outline"} 
                        size={normalize(22)} 
                        color={isPaid ? '#10B981' : theme.textSecondary} 
                      />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.feeTitle, { color: theme.textPrimary }]}>{fee.title}</Text>
                      <Text style={[styles.feeDeadline, { color: theme.textSecondary }]}>
                        Límite: <Text style={{ fontWeight: '600', color: isPaid ? '#10B981' : '#F59E0B' }}>{fee.deadline || fee.dueDate || 'Sin fecha límite'}</Text>
                      </Text>
                      <Text style={[styles.feeAmount, { color: theme.accent }]}>
                        ${Number(fee.amount).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.feeCardRightActions}>
                    <TouchableOpacity
                      style={[
                        styles.feeToggleBtn,
                        isPaid 
                          ? { backgroundColor: isDarkMode ? '#064E3B40' : '#D1FAE5', borderColor: '#10B981' } 
                          : { backgroundColor: theme.accent, borderColor: theme.accent }
                      ]}
                      onPress={() => handleToggleFeeStatus(fee.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.feeToggleBtnText,
                        isPaid ? { color: '#10B981', fontWeight: '700' } : { color: '#FFFFFF', fontWeight: '700' }
                      ]}>
                        {isPaid ? 'Pagada ✓' : 'Pendiente'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.feeIconsRow}>
                      <TouchableOpacity
                        style={[styles.feeActionIconBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}
                        onPress={() => handleOpenEditFee(fee)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="pencil-outline" size={normalize(15)} color={theme.accent} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.feeActionIconBtn, { backgroundColor: isDarkMode ? '#311C1C' : '#FEE2E2' }]}
                        onPress={() => handleDeleteFee(fee.id, fee.title)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={normalize(15)} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: normalize(40) }} />
        </ScrollView>
      )}

      {/* MODAL MANUAL: ANOTAR O EDITAR CUOTA */}
      <Modal
        visible={feeModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFeeModalVisible(false)}
      >
        <View style={styles.feeModalOverlay}>
          <View style={[styles.feeModalContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.feeModalHeader}>
              <Text style={[styles.feeModalTitle, { color: theme.textPrimary }]}>
                {editingFeeId ? 'Editar Cuota' : 'Anotar Cuota Universitaria'}
              </Text>
              <TouchableOpacity onPress={() => setFeeModalVisible(false)}>
                <Ionicons name="close" size={normalize(22)} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Concepto / Nombre */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Nombre o Concepto</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: theme.textPrimary, borderColor: theme.border }]}
                placeholder="Ej. Cuota 1 Enero, Matrícula, Lab..."
                placeholderTextColor={theme.textSecondary}
                value={formFeeTitle}
                onChangeText={setFormFeeTitle}
              />

              {/* Monto */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Monto ($)</Text>
              <View style={[styles.currencyInputContainer, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: theme.border }]}>
                <Text style={[styles.currencySymbol, { color: theme.accent }]}>$</Text>
                <TextInput
                  style={[styles.currencyInput, { color: theme.textPrimary }]}
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  value={formFeeAmount}
                  onChangeText={setFormFeeAmount}
                />
              </View>

              {/* Fecha Límite */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Fecha Límite de Pago (Calendario)</Text>
              <TouchableOpacity
                style={[
                  styles.datePickerBtn,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                    borderColor: showFeeDatePicker ? theme.accent : theme.border,
                  }
                ]}
                onPress={() => setShowFeeDatePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.datePickerBtnLeft}>
                  <Ionicons name="calendar-outline" size={normalize(18)} color={theme.accent} style={{ marginRight: normalize(8) }} />
                  <Text style={[styles.datePickerBtnText, { color: formFeeDeadline ? theme.textPrimary : theme.textSecondary }]}>
                    {formFeeDeadline || 'Seleccionar fecha en calendario'}
                  </Text>
                </View>
                <Ionicons name="calendar" size={normalize(16)} color={theme.accent} />
              </TouchableOpacity>

              {showFeeDatePicker && (
                <DateTimePicker
                  value={feeDateObject}
                  mode="date"
                  display={Platform.OS === 'android' ? 'calendar' : 'default'}
                  onChange={onFeeDateChange}
                />
              )}

              {/* Estado */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Estado del Pago</Text>
              <View style={styles.feeStatusSelector}>
                <TouchableOpacity
                  style={[
                    styles.feeStatusOption,
                    { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.border },
                    formFeeStatus === 'pending' && { backgroundColor: '#F59E0B20', borderColor: '#F59E0B' }
                  ]}
                  onPress={() => setFormFeeStatus('pending')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={normalize(16)} color={formFeeStatus === 'pending' ? '#F59E0B' : theme.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.feeStatusText, { color: formFeeStatus === 'pending' ? '#F59E0B' : theme.textSecondary, fontWeight: formFeeStatus === 'pending' ? '700' : '500' }]}>
                    Pendiente
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.feeStatusOption,
                    { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.border },
                    formFeeStatus === 'paid' && { backgroundColor: '#10B98120', borderColor: '#10B981' }
                  ]}
                  onPress={() => setFormFeeStatus('paid')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle-outline" size={normalize(16)} color={formFeeStatus === 'paid' ? '#10B981' : theme.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.feeStatusText, { color: formFeeStatus === 'paid' ? '#10B981' : theme.textSecondary, fontWeight: formFeeStatus === 'paid' ? '700' : '500' }]}>
                    Pagada
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Botón Guardar */}
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: theme.accent, marginTop: normalize(20) }]}
                onPress={handleSaveFee}
                activeOpacity={0.9}
              >
                <Text style={styles.btnText}>
                  {editingFeeId ? 'Guardar Cambios' : 'Anotar Cuota'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnCancelFee, { borderColor: theme.border }]}
                onPress={() => setFeeModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.btnCancelFeeText, { color: theme.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: EDITAR CICLO ACADÉMICO */}
      <Modal
        visible={cycleModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCycleModalVisible(false)}
      >
        <View style={styles.feeModalOverlay}>
          <View style={[styles.feeModalContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.feeModalHeader}>
              <Text style={[styles.feeModalTitle, { color: theme.textPrimary }]}>Editar Ciclo Académico</Text>
              <TouchableOpacity onPress={() => setCycleModalVisible(false)}>
                <Ionicons name="close" size={normalize(22)} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Nombre / Número del Ciclo</Text>
            <TextInput
              style={[
                styles.modalInput,
                { 
                  backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', 
                  borderColor: theme.border, 
                  color: theme.textPrimary 
                }
              ]}
              placeholder="Ej. Ciclo 01, Ciclo 02, Interciclo"
              placeholderTextColor={theme.textSecondary}
              value={inputCycle}
              onChangeText={setInputCycle}
              autoFocus={true}
            />

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.accent, marginTop: normalize(12) }]}
              onPress={() => saveCycle(inputCycle)}
              activeOpacity={0.9}
            >
              <Text style={styles.btnText}>Guardar Ciclo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnCancelFee, { borderColor: theme.border }]}
              onPress={() => setCycleModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnCancelFeeText, { color: theme.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: normalize(16) 
  },
  card: { 
    padding: normalize(20), 
    borderRadius: normalize(16), 
    borderWidth: 1, 
    marginBottom: normalize(24) 
  },
  cardTitle: { 
    fontSize: normalize(16), 
    fontWeight: '700', 
    marginBottom: normalize(18) 
  },
  inputLabel: { 
    fontSize: normalize(11), 
    fontWeight: '600', 
    marginBottom: normalize(6), 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  currencyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: normalize(12),
    borderWidth: 1,
    marginBottom: normalize(16),
    paddingLeft: normalize(16),
    height: normalize(48)
  },
  currencySymbol: {
    fontSize: normalize(16),
    fontWeight: '600',
    marginRight: normalize(2)
  },
  currencyInput: {
    flex: 1,
    paddingVertical: normalize(10),
    paddingRight: normalize(16),
    fontSize: normalize(15),
    fontWeight: '500'
  },
  customSelectTrigger: { 
    paddingHorizontal: normalize(16), 
    borderRadius: normalize(12), 
    marginBottom: normalize(16), 
    borderWidth: 1, 
    justifyContent: 'center', 
    height: normalize(48) 
  },
  selectTriggerText: { 
    fontSize: normalize(14)
  },
  btn: { 
    padding: normalize(14), 
    borderRadius: normalize(12), 
    alignItems: 'center', 
    justifyContent: 'center',
    height: normalize(48),
    marginTop: normalize(4) 
  },
  btnText: { 
    color: '#FFFFFF', 
    fontWeight: '600', 
    fontSize: normalize(15) 
  },
  sectionHeader: { 
    marginBottom: normalize(14) 
  },
  sectionTitle: { 
    fontSize: normalize(16), 
    fontWeight: '700' 
  },
  sectionSubtitle: { 
    fontSize: normalize(12), 
    marginTop: normalize(2) 
  },
  lblMini: { 
    fontSize: normalize(11), 
    fontWeight: '600', 
    marginBottom: normalize(8), 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  scrollChipsWrapper: {
    height: normalize(38), 
    marginBottom: normalize(16)
  },
  chipContainer: { 
    flexDirection: 'row' 
  },
  chip: { 
    paddingVertical: normalize(6), 
    paddingHorizontal: normalize(14), 
    borderRadius: normalize(20), 
    marginRight: normalize(8), 
    borderWidth: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: normalize(32) 
  },
  chipText: { 
    fontSize: normalize(12), 
    fontWeight: '500' 
  },
  listContainerStyle: { 
    borderRadius: normalize(16), 
    borderWidth: 1, 
    overflow: 'hidden' 
  },
  budgetListItem: { 
    padding: normalize(16), 
    borderBottomWidth: 1
  },
  budgetMainRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  rowDeleteBtn: { 
    backgroundColor: '#FFF5F5', 
    paddingVertical: normalize(8), 
    paddingHorizontal: normalize(12), 
    borderRadius: normalize(10), 
    marginLeft: normalize(12),
    borderWidth: 1,
    borderColor: '#FFE3E3',
    justifyContent: 'center',
    alignItems: 'center'
  },
  rowDeleteBtnText: { 
    color: '#E53E3E', 
    fontSize: normalize(12), 
    fontWeight: '600' 
  },
  emptyContainer: { 
    paddingVertical: normalize(40), 
    paddingHorizontal: normalize(16) 
  },
  empty: { 
    textAlign: 'center', 
    fontSize: normalize(14), 
    fontStyle: 'italic' 
  },
  textWhite: { 
    color: '#FFFFFF', 
    fontWeight: '600' 
  },
  tabSegmentContainer: {
    flexDirection: 'row',
    borderRadius: normalize(12),
    padding: normalize(4),
    marginBottom: normalize(16)
  },
  tabSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(10),
    borderRadius: normalize(9)
  },
  tabSegmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  tabSegmentText: {
    fontSize: normalize(13),
    fontWeight: '600'
  },
  feeSummaryCard: {
    padding: normalize(16),
    borderRadius: normalize(16),
    borderWidth: 1,
    marginBottom: normalize(16)
  },
  feeSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(14)
  },
  feeSummaryTitle: {
    fontSize: normalize(16),
    fontWeight: '700'
  },
  feeSummarySubtitle: {
    fontSize: normalize(12),
    marginTop: 2
  },
  badgeCycle: {
    paddingVertical: normalize(4),
    paddingHorizontal: normalize(10),
    borderRadius: normalize(12)
  },
  badgeCycleText: {
    fontSize: normalize(11),
    fontWeight: '700'
  },
  feeSummaryGrid: {
    flexDirection: 'row',
    gap: normalize(10)
  },
  feeMetricBox: {
    flex: 1,
    padding: normalize(12),
    borderRadius: normalize(12),
    borderWidth: 1
  },
  feeMetricLabel: {
    fontSize: normalize(11),
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2
  },
  feeMetricValue: {
    fontSize: normalize(18),
    fontWeight: '800'
  },
  feeCard: {
    padding: normalize(14),
    borderRadius: normalize(14),
    borderWidth: 1,
    marginBottom: normalize(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  feeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: normalize(10)
  },
  feeIconCircle: {
    width: normalize(42),
    height: normalize(42),
    borderRadius: normalize(21),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: normalize(12)
  },
  feeTitle: {
    fontSize: normalize(14),
    fontWeight: '700'
  },
  feeDeadline: {
    fontSize: normalize(11),
    marginTop: 2
  },
  feeAmount: {
    fontSize: normalize(15),
    fontWeight: '800',
    marginTop: 4
  },
  feeToggleBtn: {
    paddingVertical: normalize(8),
    paddingHorizontal: normalize(12),
    borderRadius: normalize(10),
    borderWidth: 1
  },
  feeToggleBtnText: {
    fontSize: normalize(11)
  },
  feeSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: normalize(12)
  },
  btnAddFeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: normalize(7),
    paddingHorizontal: normalize(12),
    borderRadius: normalize(10)
  },
  btnAddFeeHeaderText: {
    color: '#FFFFFF',
    fontSize: normalize(12),
    fontWeight: '700'
  },
  emptyFeeCard: {
    padding: normalize(28),
    borderRadius: normalize(16),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: normalize(10)
  },
  emptyFeeTitle: {
    fontSize: normalize(16),
    fontWeight: '700',
    marginBottom: normalize(4)
  },
  emptyFeeSubtitle: {
    fontSize: normalize(12),
    textAlign: 'center',
    lineHeight: normalize(18),
    paddingHorizontal: normalize(12)
  },
  feeCardRightActions: {
    alignItems: 'flex-end',
    gap: normalize(8)
  },
  feeIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(6)
  },
  feeActionIconBtn: {
    width: normalize(30),
    height: normalize(30),
    borderRadius: normalize(8),
    alignItems: 'center',
    justifyContent: 'center'
  },
  feeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: normalize(16)
  },
  feeModalContent: {
    borderRadius: normalize(18),
    padding: normalize(20),
    borderWidth: 1,
    maxHeight: '90%'
  },
  feeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(16)
  },
  feeModalTitle: {
    fontSize: normalize(17),
    fontWeight: '700'
  },
  modalInput: {
    height: normalize(44),
    borderWidth: 1,
    borderRadius: normalize(12),
    paddingHorizontal: normalize(14),
    fontSize: normalize(14),
    marginBottom: normalize(14)
  },
  feeStatusSelector: {
    flexDirection: 'row',
    gap: normalize(10),
    marginBottom: normalize(10)
  },
  feeStatusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(10),
    borderRadius: normalize(10),
    borderWidth: 1
  },
  feeStatusText: {
    fontSize: normalize(12)
  },
  btnCancelFee: {
    marginTop: normalize(10),
    paddingVertical: normalize(10),
    borderRadius: normalize(12),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnCancelFeeText: {
    fontSize: normalize(13),
    fontWeight: '600'
  },
  datePickerBtn: {
    height: normalize(46),
    borderWidth: 1,
    borderRadius: normalize(12),
    paddingHorizontal: normalize(14),
    marginBottom: normalize(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  datePickerBtnText: {
    fontSize: normalize(14),
    fontWeight: '500',
  }
});