import React, { useState, useContext, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView,
  KeyboardAvoidingView, 
  Platform,
  Modal,
  Dimensions,
  PixelRatio
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FinanceContext } from '../context/FinanceContext';
import { ThemeContext } from '../context/ThemeContext'; 
import DateTimePicker from '@react-native-community/datetimepicker';

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

const DEFAULT_ACCOUNTS = [
  { id: 'default_efectivo', name: 'Efectivo' },
  { id: 'default_tarjeta', name: 'Tarjeta' },
  { id: 'default_banco', name: 'Cuenta banco' }
];

export default function TransactionsScreen() {
  const { 
    transactions = [], 
    accounts = [], 
    allCategories = [], 
    addTransaction, 
    updateTransaction, 
    deleteTransaction, 
    addAccount,
    deleteAccount,
    addCustomCategory,
    deleteCustomCategory, 
    customCategories = []  
  } = useContext(FinanceContext) || {};

  const { theme, isDarkMode } = useContext(ThemeContext); 

  // --- ESTADOS DEL FORMULARIO DE CAPTURA/EDICIÓN ---
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState('$');
  const [type, setType] = useState('expense'); 
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [description, setDescription] = useState('');
  
  // --- ESTADOS PARA EL CALENDARIO Y SELECTORES ---
  const [dateObject, setDateObject] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [filterCustomDate, setFilterCustomDate] = useState(new Date());
  const [showFilterDatePicker, setShowFilterDatePicker] = useState(false);
  const [showCatSelector, setShowCatSelector] = useState(false);
  const [showFilterCatSelector, setShowFilterCatSelector] = useState(false);

  // --- ESTADO PARA CREAR NUEVOS ELEMENTOS ---
  const [newAccountName, setNewAccountName] = useState('');
  const [newCatName, setNewCatName] = useState('');

  // --- ESTADOS DE FILTROS AVANZADOS Y BÚSQUEDA ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterCategory, setFilterCategory] = useState(''); 
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // --- ESTADOS PARA EL MODAL TICKET ---
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isTicketVisible, setIsTicketVisible] = useState(false);

  const displayAccounts = accounts.length > 0 ? accounts : DEFAULT_ACCOUNTS;

  useEffect(() => {
    const initializeDefaultAccounts = async () => {
      if (accounts.length === 0 && typeof addAccount === 'function') {
        try {
          await addAccount('Efectivo');
          await addAccount('Tarjeta');
          await addAccount('Cuenta banco');
        } catch (error) {
          console.log('Error al inicializar cuentas:', error);
        }
      }
    };
    initializeDefaultAccounts();
  }, [accounts.length]);

  useEffect(() => {
    if (displayAccounts.length > 0 && !accountId) {
      setAccountId(displayAccounts[0].id);
    }
  }, [displayAccounts, accountId]);

  // Filtro estricto de texto: Remueve cualquier dígito numérico del string
  const handleTextOnlyChange = (text, setTargetState) => {
    const cleanText = text.replace(/[0-9]/g, '');
    setTargetState(cleanText);
  };

  const handleAmountChange = (text) => {
    if (text === '' || text === '$') {
      setAmount('$');
      return;
    }
    let cleanNumber = text.replace(/[^0-9.]/g, '');
    const parts = cleanNumber.split('.');
    if (parts.length > 2) {
      cleanNumber = parts[0] + '.' + parts.slice(1).join('');
    }
    setAmount(`$${cleanNumber}`);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) {
      const updated = new Date(dateObject);
      updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDateObject(updated);
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (event.type === 'dismissed') return;
    if (selectedTime) {
      const updated = new Date(dateObject);
      updated.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      setDateObject(updated);
    }
  };

  const getDisplayDateString = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getDisplayTimeString = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = hours < 10 ? `0${hours}` : `${hours}`;
    const strMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${strHours}:${strMinutes} ${ampm}`;
  };

  const parseTimeStringToDate = (timeStr) => {
    const d = new Date();
    if (!timeStr) return d;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return d;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = (match[3] || '').toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const getDatabaseDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert('Incompleto', 'Por favor ingresa un nombre válido para la categoría.');
      return;
    }
    if (typeof addCustomCategory !== 'function') return;
    
    const res = await addCustomCategory(newCatName.trim());
    if (res && res.success) {
      Alert.alert('Éxito', `Categoría "${newCatName.trim()}" guardada.`);
      setCategory(newCatName.trim());
      setNewCatName('');
    } else {
      Alert.alert('Aviso', res?.message || 'No se pudo guardar la categoría.');
    }
  };

  const confirmDeleteCategory = (categoryName) => {
    const foundCategory = customCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    if (!foundCategory) {
      Alert.alert('Aviso', 'Las categorías predeterminadas no se pueden eliminar.');
      return;
    }
    Alert.alert(
      'Eliminar Categoría',
      `¿Estás seguro de borrar permanentemente "${categoryName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteCustomCategory(foundCategory.id);
              if (category === categoryName) setCategory('');
              if (filterCategory === categoryName) setFilterCategory('');
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la categoría.');
            }
          } 
        }
      ]
    );
  };

  const confirmDeleteAccount = (account) => {
    const protectedNames = ['efectivo', 'tarjeta', 'cuenta banco', 'banco'];
    const currentNameClean = account.name.toLowerCase().trim();
    
    if (account.id.startsWith('default_') || protectedNames.includes(currentNameClean)) {
      Alert.alert('Acceso Denegado', 'Esta cuenta es requerida por el sistema.');
      return;
    }

    Alert.alert(
      'Eliminar Cuenta',
      `¿Estás seguro de borrar "${account.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteAccount(account.id);
              if (accountId === account.id) setAccountId('');
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la cuenta.');
            }
          } 
        }
      ]
    );
  };

  const handleSave = async () => {
    const rawAmount = amount.replace('$', '');
    if (!rawAmount.trim() || !category.trim() || !description.trim() || !accountId) {
      Alert.alert('Campos vacíos', 'Asegúrate de llenar todos los datos.');
      return;
    }
    if (isNaN(Number(rawAmount)) || Number(rawAmount) <= 0) {
      Alert.alert('Monto Inválido', 'Ingresa un número mayor a cero.');
      return;
    }

    const transactionData = {
      amount: Number(rawAmount),
      type,
      category: category.trim(),
      accountId,
      description: description.trim(),
      date: getDatabaseDateString(dateObject),
      time: getDisplayTimeString(dateObject)
    };

    try {
      if (editingId) {
        await updateTransaction(editingId, transactionData);
        Alert.alert('Modificado', 'La transacción fue actualizada.');
      } else {
        await addTransaction(transactionData);
        Alert.alert('Guardado', 'La transacción fue registrada.');
      }
      resetForm();
    } catch (e) {
      Alert.alert('Error', 'Hubo un problema al guardar.');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setAmount('$');
    setCategory('');
    setDescription('');
    setType('expense');
    if (displayAccounts.length > 0) setAccountId(displayAccounts[0].id);
    setDateObject(new Date());
    setShowCatSelector(false);
  };

  const handleSelectEdit = (item) => {
    setEditingId(item.id);
    setAmount(`$${item.amount}`);
    setType(item.type);
    setCategory(item.category);
    setAccountId(item.accountId);
    setDescription(item.description);
    if (item.date) {
      const parts = item.date.split('-');
      const d = parts.length === 3 
        ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0)
        : new Date();
      if (item.time) {
        const parsedT = parseTimeStringToDate(item.time);
        d.setHours(parsedT.getHours(), parsedT.getMinutes(), 0, 0);
      }
      setDateObject(d);
    }
  };

  const confirmDelete = (id) => {
    Alert.alert(
      'Confirmar Eliminación',
      '¿Deseas borrar permanentemente esta transacción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteTransaction(id) }
      ]
    );
  };

  const handleOpenTicket = (item) => {
    setSelectedTicket(item);
    setIsTicketVisible(true);
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesAccount = filterAccount === 'all' || t.accountId === filterAccount;
    const matchesCategory = filterCategory === '' || (t.category && t.category.toLowerCase() === filterCategory.toLowerCase());
    const matchesType = filterType === 'all' || t.type === filterType;
    
    let matchesPeriod = true;
    if (filterPeriod === 'current_month') {
      const currentYearMonth = new Date().toISOString().slice(0, 7);
      matchesPeriod = t.date && t.date.startsWith(currentYearMonth);
    } else if (filterPeriod === 'today') {
      const todayStr = getDatabaseDateString(new Date());
      matchesPeriod = t.date === todayStr;
    } else if (filterPeriod === 'custom') {
      const customStr = getDatabaseDateString(filterCustomDate);
      matchesPeriod = t.date === customStr;
    }

    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q)) ||
      String(t.amount || '').includes(q);
    
    return matchesAccount && matchesCategory && matchesPeriod && matchesType && matchesSearch;
  });

  const renderHistoryDate = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateString;
  };

  const filteredTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.type === 'income') income += amt;
      else expense += amt;
    });
    return {
      income,
      expense,
      net: income - expense,
      count: filteredTransactions.length
    };
  }, [filteredTransactions]);

  const getCategoryMeta = (catName, itemType) => {
    const clean = (catName || '').toLowerCase().trim();
    if (itemType === 'income') {
      return { icon: 'arrow-down-circle', color: '#10B981', bg: isDarkMode ? '#064E3B40' : '#D1FAE5' };
    }
    if (clean.includes('aliment') || clean.includes('comid')) {
      return { icon: 'restaurant', color: '#F97316', bg: isDarkMode ? '#43140740' : '#FFEDD5' };
    }
    if (clean.includes('transp') || clean.includes('bus') || clean.includes('uber') || clean.includes('gas')) {
      return { icon: 'bus', color: '#0284C7', bg: isDarkMode ? '#082F4940' : '#E0F2FE' };
    }
    if (clean.includes('estudio') || clean.includes('udb') || clean.includes('universid') || clean.includes('libro')) {
      return { icon: 'school', color: '#8B5CF6', bg: isDarkMode ? '#2E106540' : '#EDE9FE' };
    }
    if (clean.includes('servici') || clean.includes('luz') || clean.includes('agua') || clean.includes('internet')) {
      return { icon: 'flash', color: '#EAB308', bg: isDarkMode ? '#42200640' : '#FEF9C3' };
    }
    if (clean.includes('entreten') || clean.includes('cine') || clean.includes('juego') || clean.includes('salid')) {
      return { icon: 'game-controller', color: '#EC4899', bg: isDarkMode ? '#50072440' : '#FCE7F3' };
    }
    if (clean.includes('salud') || clean.includes('medic') || clean.includes('farmacia')) {
      return { icon: 'medkit', color: '#EF4444', bg: isDarkMode ? '#450A0A40' : '#FEE2E2' };
    }
    return { icon: 'wallet', color: '#6366F1', bg: isDarkMode ? '#1E1B4B40' : '#E0E7FF' };
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* BLOQUE 1: FORMULARIO DINÁMICO PRINCIPAL */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
            {editingId ? '✏️ Editando Registro' : '➕ Capturar Transacción'}
          </Text>
          
          <View style={[styles.typeSelectorRow, { backgroundColor: isDarkMode ? theme.background : '#F1F5F9' }]}>
            <TouchableOpacity 
              style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpenseActive]} 
              onPress={() => setType('expense')}
            >
              <Text style={[styles.typeBtnText, { color: type === 'expense' ? '#FFFFFF' : theme.textSecondary }]}>Gasto</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.typeBtn, type === 'income' && styles.typeBtnIncomeActive]} 
              onPress={() => setType('income')}
            >
              <Text style={[styles.typeBtnText, { color: type === 'income' ? '#FFFFFF' : theme.textSecondary }]}>Ingreso</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: normalize(8) }}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Monto</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.background, color: theme.textPrimary, borderColor: theme.border }]} 
                placeholder="$0.00" 
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric" 
                value={amount} 
                onChangeText={handleAmountChange} 
              />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Categoría</Text>
              <TouchableOpacity onPress={() => setShowCatSelector(!showCatSelector)} activeOpacity={0.8}>
                <View style={[
                  styles.customSelectTrigger, 
                  { backgroundColor: theme.background, borderColor: theme.border },
                  category !== '' && { borderColor: theme.accent, borderWidth: 1.5 }
                ]}>
                  <Text style={[
                    styles.selectTriggerText, 
                    { color: theme.textSecondary },
                    category !== '' && { color: theme.textPrimary, fontWeight: '500' }
                  ]} numberOfLines={1}>
                    {category || 'Seleccionar 🔍'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {showCatSelector && (
            <View style={[styles.selectorWrapper, { borderColor: theme.border }]}>
              <Text style={[styles.lblMini, { color: theme.textSecondary }]}>Presiona para elegir / Mantén para borrar:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', paddingVertical: normalize(4) }}>
                {(allCategories || []).map((cat, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={[
                      styles.chip, 
                      { backgroundColor: isDarkMode ? theme.background : '#E2E8F0' },
                      category.toLowerCase() === cat.toLowerCase() && { backgroundColor: theme.accent }
                    ]} 
                    onPress={() => { setCategory(cat); setShowCatSelector(false); }}
                    onLongPress={() => confirmDeleteCategory(cat)} 
                    delayLongPress={600}
                  >
                    <Text style={[
                      styles.chipText, 
                      { color: theme.textPrimary },
                      category.toLowerCase() === cat.toLowerCase() && styles.textWhite
                    ]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: normalize(8) }}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Fecha (Calendario)</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
                <View style={[styles.customSelectTrigger, { backgroundColor: theme.background, borderColor: showDatePicker ? theme.accent : theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: normalize(13), color: theme.textPrimary, fontWeight: '500' }}>
                    {getDisplayDateString(dateObject)}
                  </Text>
                  <Ionicons name="calendar-outline" size={normalize(16)} color={theme.accent} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Hora (Reloj)</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(true)} activeOpacity={0.8}>
                <View style={[styles.customSelectTrigger, { backgroundColor: theme.background, borderColor: showTimePicker ? theme.accent : theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: normalize(13), color: theme.textPrimary, fontWeight: '500' }}>
                    {getDisplayTimeString(dateObject)}
                  </Text>
                  <Ionicons name="time-outline" size={normalize(16)} color={theme.accent} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginBottom: normalize(10) }}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Descripción</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: theme.background, color: theme.textPrimary, borderColor: theme.border }]} 
              placeholder="Ej. Almuerzo, Transporte, Compra..." 
              placeholderTextColor={theme.textSecondary}
              value={description} 
              onChangeText={(text) => handleTextOnlyChange(text, setDescription)} 
            />
          </View>

          {showDatePicker && (
            <DateTimePicker 
              value={dateObject} 
              mode="date" 
              display={Platform.OS === 'android' ? 'calendar' : 'default'} 
              onChange={onDateChange} 
            />
          )}

          {showTimePicker && (
            <DateTimePicker 
              value={dateObject} 
              mode="time" 
              is24Hour={false}
              display={Platform.OS === 'android' ? 'clock' : 'default'} 
              onChange={onTimeChange} 
            />
          )}

          <Text style={[styles.sectionInnerLabel, { color: theme.textSecondary }]}>Cuenta Origen/Destino</Text>
          <View style={{ marginBottom: normalize(16) }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
              {displayAccounts.map(acc => (
                <TouchableOpacity 
                  key={acc.id} 
                  style={[
                    styles.accountChip, 
                    { backgroundColor: isDarkMode ? theme.background : '#E2E8F0', borderColor: theme.border },
                    accountId === acc.id && { backgroundColor: theme.accent }
                  ]} 
                  onPress={() => setAccountId(acc.id)}
                  onLongPress={() => confirmDeleteAccount(acc)}
                  delayLongPress={600}
                >
                  <Text style={[
                    styles.accountChipText, 
                    { color: theme.textPrimary },
                    accountId === acc.id && styles.textWhite
                  ]}>💳 {acc.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.row}>
            <TouchableOpacity 
              style={[styles.btnSave, { backgroundColor: theme.accent }, editingId && { backgroundColor: '#F59E0B' }]} 
              onPress={handleSave}
              activeOpacity={0.9}
            >
              <Text style={styles.btnText}>{editingId ? 'Guardar Cambios' : 'Registrar Movimiento'}</Text>
            </TouchableOpacity>
            {editingId && (
              <TouchableOpacity style={[styles.btnCancel, { borderColor: theme.border }]} onPress={resetForm}>
                <Text style={[styles.btnCancelText, { color: theme.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* BLOQUE 2: ADMINISTRACIÓN DE CUENTAS Y CATEGORÍAS */}
        <View style={styles.cardRowLayout}>
          {/* NUEVA CUENTA: Libre (Acepta caracteres alfanuméricos) */}
          <View style={[styles.cardHalf, { marginRight: normalize(10), backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.smallCardTitle, { color: theme.textPrimary }]}>＋ Nueva Cuenta</Text>
            <TextInput 
              style={[styles.smallInput, { backgroundColor: theme.background, color: theme.textPrimary, borderColor: theme.border }]} 
              placeholder="Ej. Visa 123..." 
              placeholderTextColor={theme.textSecondary}
              value={newAccountName} 
              onChangeText={setNewAccountName} 
              autoCapitalize="sentences"
            />
            <TouchableOpacity style={[styles.smallCardBtn, { backgroundColor: theme.accent }]} onPress={() => {
              if(!newAccountName.trim()) return;
              addAccount(newAccountName.trim());
              setNewAccountName('');
              Alert.alert('Éxito', 'Cuenta creada de forma exitosa.');
            }}>
              <Text style={styles.smallCardBtnText}>Crear</Text>
            </TouchableOpacity>
          </View>

          {/* NUEVA CATEGORÍA: Estrictamente texto (Filtra y remueve números) */}
          <View style={[styles.cardHalf, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.smallCardTitle, { color: theme.textPrimary }]}>🏷️ Nueva Categoría</Text>
            <TextInput 
              style={[styles.smallInput, { backgroundColor: theme.background, color: theme.textPrimary, borderColor: theme.border }]} 
              placeholder="Nombre..." 
              placeholderTextColor={theme.textSecondary}
              value={newCatName} 
              onChangeText={(text) => handleTextOnlyChange(text, setNewCatName)} 
              autoCapitalize="sentences"
            />
            <TouchableOpacity style={[styles.smallCardBtn, { backgroundColor: '#6366F1' }]} onPress={handleCreateCategory}>
              <Text style={styles.smallCardBtnText}>Añadir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* BLOQUE 3: BÚSQUEDA Y FILTROS */}
        <View style={[styles.filterCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.filterCardTitle, { color: theme.textPrimary }]}>🔍 Búsqueda y Filtros</Text>

          {/* Barra de Búsqueda Interactiva */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.background,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: normalize(8),
            paddingHorizontal: normalize(10),
            paddingVertical: Platform.OS === 'ios' ? normalize(8) : normalize(4),
            marginBottom: normalize(10),
            gap: normalize(6)
          }}>
            <Ionicons name="search-outline" size={normalize(16)} color={theme.textSecondary} />
            <TextInput
              style={{ flex: 1, color: theme.textPrimary, fontSize: normalize(12) }}
              placeholder="Buscar por descripción, categoría o monto..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={normalize(16)} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <View style={{ marginBottom: normalize(12) }}>
            <Text style={[styles.lblMini, { color: theme.textSecondary }]}>Filtrar por Categoría:</Text>
            <TouchableOpacity onPress={() => setShowFilterCatSelector(!showFilterCatSelector)} activeOpacity={0.8}>
              <View style={[
                styles.customSelectTrigger, 
                { backgroundColor: theme.background, borderColor: theme.border, marginBottom: normalize(4) },
                filterCategory !== '' && { borderColor: theme.accent, borderWidth: 1.5 }
              ]}>
                <Text style={[
                  styles.selectTriggerText, 
                  { color: theme.textSecondary },
                  filterCategory !== '' && { color: theme.textPrimary, fontWeight: '500' }
                ]} numberOfLines={1}>
                  {filterCategory || 'Todas las categorías 🔍'}
                </Text>
              </View>
            </TouchableOpacity>
            
            {filterCategory !== '' && (
              <TouchableOpacity onPress={() => setFilterCategory('')} style={{ alignSelf: 'flex-end', marginTop: normalize(2) }}>
                <Text style={{ fontSize: normalize(11), color: theme.danger, fontWeight: '600' }}>✖ Quitar Filtro</Text>
              </TouchableOpacity>
            )}
          </View>

          {showFilterCatSelector && (
            <View style={[styles.selectorWrapper, { borderColor: theme.border, marginBottom: normalize(12) }]}>
              <Text style={[styles.lblMini, { color: theme.textSecondary }]}>Selecciona una categoría para filtrar:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', paddingVertical: normalize(4) }}>
                <TouchableOpacity 
                  style={[
                    styles.chip, 
                    { backgroundColor: isDarkMode ? theme.background : '#E2E8F0' },
                    filterCategory === '' && { backgroundColor: theme.accent }
                  ]} 
                  onPress={() => { setFilterCategory(''); setShowFilterCatSelector(false); }}
                >
                  <Text style={[styles.chipText, { color: theme.textPrimary }, filterCategory === '' && styles.textWhite]}>Todas</Text>
                </TouchableOpacity>
                {(allCategories || []).map((cat, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={[
                      styles.chip, 
                      { backgroundColor: isDarkMode ? theme.background : '#E2E8F0' },
                      filterCategory.toLowerCase() === cat.toLowerCase() && { backgroundColor: theme.accent }
                    ]} 
                    onPress={() => { setFilterCategory(cat); setShowFilterCatSelector(false); }}
                  >
                    <Text style={[
                      styles.chipText, 
                      { color: theme.textPrimary },
                      filterCategory.toLowerCase() === cat.toLowerCase() && styles.textWhite
                    ]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ marginBottom: normalize(10) }}>
            <Text style={[styles.lblMini, { color: theme.textSecondary }]}>Tipo de Movimiento:</Text>
            <View style={styles.filterMiniRow}>
              {['all', 'expense', 'income'].map((t) => (
                <TouchableOpacity 
                  key={t}
                  style={[
                    styles.filterMiniBtn, 
                    { backgroundColor: isDarkMode ? theme.background : '#F1F5F9' },
                    filterType === t && { backgroundColor: theme.accent }
                  ]} 
                  onPress={() => setFilterType(t)}
                >
                  <Text style={[
                    styles.filterMiniText, 
                    { color: theme.textSecondary },
                    filterType === t && styles.textWhite
                  ]}>
                    {t === 'all' ? 'Todos' : t === 'expense' ? 'Gastos' : 'Ingresos'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: normalize(6) }}>
              <Text style={[styles.lblMini, { color: theme.textSecondary }]}>Periodo:</Text>
              <View style={styles.filterMiniRow}>
                {['all', 'today', 'current_month', 'custom'].map((p) => (
                  <TouchableOpacity 
                    key={p}
                    style={[
                      styles.filterMiniBtn, 
                      { backgroundColor: isDarkMode ? theme.background : '#F1F5F9' },
                      filterPeriod === p && { backgroundColor: theme.accent }
                    ]} 
                    onPress={() => setFilterPeriod(p)}
                  >
                    <Text style={[
                      styles.filterMiniText, 
                      { color: theme.textSecondary },
                      filterPeriod === p && styles.textWhite
                    ]}>
                      {p === 'all' ? 'Todo' : p === 'today' ? 'Hoy' : p === 'current_month' ? 'Mes' : 'Fecha 📅'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ flex: 1.2 }}>
              <Text style={[styles.lblMini, { color: theme.textSecondary }]}>Cuenta:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterMiniRow}>
                <TouchableOpacity 
                  style={[
                    styles.filterMiniBtn, 
                    { backgroundColor: isDarkMode ? theme.background : '#F1F5F9' },
                    filterAccount === 'all' && { backgroundColor: theme.accent }
                  ]} 
                  onPress={() => setFilterAccount('all')}
                >
                  <Text style={[styles.filterMiniText, { color: theme.textSecondary }, filterAccount === 'all' && styles.textWhite]}>Todas</Text>
                </TouchableOpacity>
                {displayAccounts.map(acc => (
                  <TouchableOpacity 
                    key={acc.id} 
                    style={[
                      styles.filterMiniBtn, 
                      { backgroundColor: isDarkMode ? theme.background : '#F1F5F9' },
                      filterAccount === acc.id && { backgroundColor: theme.accent }
                    ]} 
                    onPress={() => setFilterAccount(acc.id)}
                  >
                    <Text style={[styles.filterMiniText, { color: theme.textSecondary }, filterAccount === acc.id && styles.textWhite]}>{acc.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {filterPeriod === 'custom' && (
            <View style={{ marginTop: normalize(8), paddingTop: normalize(8), borderTopWidth: 1, borderTopColor: theme.border }}>
              <Text style={[styles.lblMini, { color: theme.textSecondary }]}>Fecha específica a filtrar (Calendario):</Text>
              <TouchableOpacity
                style={[
                  styles.customSelectTrigger,
                  {
                    backgroundColor: theme.background,
                    borderColor: showFilterDatePicker ? theme.accent : theme.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: normalize(4),
                  }
                ]}
                onPress={() => setShowFilterDatePicker(true)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={normalize(16)} color={theme.accent} style={{ marginRight: normalize(6) }} />
                  <Text style={{ fontSize: normalize(13), color: theme.textPrimary, fontWeight: '600' }}>
                    {getDisplayDateString(filterCustomDate)}
                  </Text>
                </View>
                <Ionicons name="calendar" size={normalize(14)} color={theme.accent} />
              </TouchableOpacity>
              {showFilterDatePicker && (
                <DateTimePicker
                  value={filterCustomDate}
                  mode="date"
                  display={Platform.OS === 'android' ? 'calendar' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowFilterDatePicker(false);
                    if (event.type !== 'dismissed' && selectedDate) {
                      setFilterCustomDate(selectedDate);
                    }
                  }}
                />
              )}
            </View>
          )}
        </View>

        {/* BLOQUE 4: HISTORIAL DE MOVIMIENTOS INTUITIVO */}
        <View style={styles.historySectionHeader}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.listHeaderTitle, { color: theme.textPrimary }]}>Historial de Movimientos</Text>
            <View style={[styles.badgeCount, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
              <Text style={[styles.badgeCountText, { color: theme.textSecondary }]}>
                {filteredTotals.count} {filteredTotals.count === 1 ? 'registro' : 'registros'}
              </Text>
            </View>
          </View>
          
          <View style={styles.historySummaryMini}>
            <Text style={[styles.listHeaderSubtitle, { color: theme.textSecondary }]}>
              {filteredTotals.count > 0 ? (
                <>
                  Balance visible:{' '}
                  <Text style={{ fontWeight: '700', color: filteredTotals.net >= 0 ? '#10B981' : '#EF4444' }}>
                    {filteredTotals.net >= 0 ? '+' : ''}${filteredTotals.net.toFixed(2)}
                  </Text>
                  {'  '}• Toca para ver recibo
                </>
              ) : (
                'Toca un registro para ver su comprobante'
              )}
            </Text>
          </View>
        </View>
        
        <View style={{ marginBottom: normalize(14) }}>
          {filteredTransactions.length === 0 ? (
            <View style={[styles.emptyHistoryBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="search-outline" size={normalize(32)} color={theme.textSecondary} style={{ marginBottom: 6 }} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No se encontraron movimientos con los filtros aplicados.
              </Text>
              {(searchQuery !== '' || filterCategory !== '' || filterPeriod !== 'all' || filterType !== 'all' || filterAccount !== 'all') && (
                <TouchableOpacity
                  style={[styles.btnResetFilters, { borderColor: theme.border }]}
                  onPress={() => {
                    setSearchQuery('');
                    setFilterCategory('');
                    setFilterPeriod('all');
                    setFilterType('all');
                    setFilterAccount('all');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: normalize(11), color: theme.accent, fontWeight: '700' }}>
                    Limpiar Filtros
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredTransactions.map((item) => {
              const currentAccountName = displayAccounts.find(a => a.id === item.accountId)?.name || 'General';
              const meta = getCategoryMeta(item.category, item.type);
              const isIncome = item.type === 'income';

              return (
                <TouchableOpacity 
                  key={item.id} 
                  style={[
                    styles.txCardIntuitive, 
                    { backgroundColor: theme.card, borderColor: theme.border },
                    editingId === item.id && { borderColor: theme.accent, borderWidth: 1.5 }
                  ]} 
                  onPress={() => handleOpenTicket(item)}
                  activeOpacity={0.75}
                >
                  {/* Icono temático de Categoría */}
                  <View style={[styles.txCategoryIconCircle, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={normalize(20)} color={meta.color} />
                  </View>

                  {/* Detalles centrales de la transacción */}
                  <View style={styles.txCenterDetails}>
                    <Text style={[styles.txCategoryTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      {item.category}
                    </Text>
                    
                    {item.description ? (
                      <Text style={[styles.txDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                        {item.description}
                      </Text>
                    ) : null}

                    <View style={styles.txTagsRow}>
                      <View style={[styles.txAccountPill, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                        <Ionicons name="card-outline" size={normalize(10)} color={theme.textSecondary} style={{ marginRight: 3 }} />
                        <Text style={[styles.txAccountPillText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {currentAccountName}
                        </Text>
                      </View>

                      <Text style={[styles.txDateText, { color: theme.textSecondary }]}>
                        {renderHistoryDate(item.date)}{item.time ? ` • ${item.time}` : ''}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Monto y Botones Rápidos */}
                  <View style={styles.txRightCol}>
                    <Text style={[
                      styles.txAmountLarge, 
                      { color: isIncome ? '#10B981' : '#EF4444' }
                    ]} numberOfLines={1}>
                      {isIncome ? '+' : '-'}${Number(item.amount || 0).toFixed(2)}
                    </Text>

                    <View style={styles.txQuickActions}>
                      <TouchableOpacity 
                        style={[styles.txMiniActionBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]} 
                        onPress={() => handleSelectEdit(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="pencil-outline" size={normalize(13)} color={theme.accent} />
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.txMiniActionBtn, { backgroundColor: isDarkMode ? '#311C1C' : '#FEE2E2', marginLeft: normalize(6) }]} 
                        onPress={() => confirmDelete(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={normalize(13)} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        <View style={{ height: normalize(60) }} />
      </ScrollView>

      {/* MODAL COMPONENTE: RECIBO MINIMALISTA ESTILO TICKET */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isTicketVisible}
        onRequestClose={() => setIsTicketVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.ticketContainer, { backgroundColor: '#FFFFFF' }]}>
            <Text style={[styles.ticketBrand, { color: '#0F172A' }]}>COMPROBANTE</Text>
            <Text style={[styles.ticketSubtitle, { color: '#64748B' }]}>Control de Finanzas Personales</Text>
            <Text style={[styles.ticketDivider, { color: '#CBD5E1' }]}>------------------------------------------</Text>
            
            {selectedTicket && (
              <View style={styles.ticketBody}>
                <View style={styles.ticketRow}>
                  <Text style={[styles.ticketLabel, { color: '#64748B' }]}>ID TRANSACCIÓN:</Text>
                  <Text style={[styles.ticketValue, { color: '#0F172A' }]}>#{selectedTicket.id?.slice(0, 8).toUpperCase()}</Text>
                </View>
                
                <View style={styles.ticketRow}>
                  <Text style={[styles.ticketLabel, { color: '#64748B' }]}>FECHA:</Text>
                  <Text style={[styles.ticketValue, { color: '#0F172A' }]}>{renderHistoryDate(selectedTicket.date)}</Text>
                </View>

                {selectedTicket.time ? (
                  <View style={styles.ticketRow}>
                    <Text style={[styles.ticketLabel, { color: '#64748B' }]}>HORA:</Text>
                    <Text style={[styles.ticketValue, { color: '#0F172A' }]}>{selectedTicket.time}</Text>
                  </View>
                ) : null}

                <View style={styles.ticketRow}>
                  <Text style={[styles.ticketLabel, { color: '#64748B' }]}>TIPO:</Text>
                  <Text style={[styles.ticketValue, { color: selectedTicket.type === 'income' ? '#10B981' : '#EF4444', fontWeight: 'bold' }]}>
                    {selectedTicket.type === 'income' ? 'INGRESO' : 'GASTO'}
                  </Text>
                </View>

                <View style={styles.ticketRow}>
                  <Text style={[styles.ticketLabel, { color: '#64748B' }]}>CATEGORÍA:</Text>
                  <Text style={[styles.ticketValue, { color: '#0F172A' }]}>{selectedTicket.category.toUpperCase()}</Text>
                </View>

                <View style={styles.ticketRow}>
                  <Text style={[styles.ticketLabel, { color: '#64748B' }]}>CUENTA:</Text>
                  <Text style={[styles.ticketValue, { color: '#0F172A' }]}>
                    {(displayAccounts.find(a => a.id === selectedTicket.accountId)?.name || 'General').toUpperCase()}
                  </Text>
                </View>

                <View style={[styles.ticketRow, { marginTop: normalize(6) }]}>
                  <Text style={[styles.ticketLabel, { color: '#64748B' }]}>DESCRIPCIÓN:</Text>
                  <Text style={[styles.ticketValue, { color: '#334155', flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                    {selectedTicket.description}
                  </Text>
                </View>

                <Text style={[styles.ticketDivider, { color: '#CBD5E1' }]}>------------------------------------------</Text>
                
                <View style={[styles.ticketRow, { marginTop: normalize(4) }]}>
                  <Text style={{ fontSize: normalize(16), fontWeight: 'bold', color: '#0F172A' }}>TOTAL:</Text>
                  <Text style={{ fontSize: normalize(18), fontWeight: 'bold', color: selectedTicket.type === 'income' ? '#10B981' : '#EF4444' }}>
                    ${selectedTicket.amount.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.ticketCloseBtn} onPress={() => setIsTicketVisible(false)}>
              <Text style={styles.ticketCloseBtnText}>CERRAR RECIBO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// --- HOJA DE ESTILOS LIMPIA Y OPTIMIZADA ---
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: normalize(14), paddingTop: normalize(10) },
  card: { borderRadius: 12, padding: normalize(14), borderWidth: 1, marginBottom: normalize(12), elevation: 2, shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: normalize(15), fontWeight: '700', marginBottom: normalize(12), textAlign: 'center' },
  typeSelectorRow: { flexDirection: 'row', borderRadius: 8, padding: 4, marginBottom: normalize(14) },
  typeBtn: { flex: 1, paddingVertical: normalize(8), alignItems: 'center', borderRadius: 6 },
  typeBtnExpenseActive: { backgroundColor: '#EF4444' },
  typeBtnIncomeActive: { backgroundColor: '#10B981' },
  typeBtnText: { fontSize: normalize(13), fontWeight: '600' },
  row: { flexDirection: 'row', marginBottom: normalize(10), alignItems: 'flex-end' },
  inputLabel: { fontSize: normalize(11), fontWeight: '600', marginBottom: 4 },
  sectionInnerLabel: { fontSize: normalize(11), fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: normalize(10), height: normalize(38), fontSize: normalize(13) },
  customSelectTrigger: { borderWidth: 1, borderRadius: 8, paddingHorizontal: normalize(10), height: normalize(38), justifyContent: 'center' },
  selectTriggerText: { fontSize: normalize(13) },
  selectorWrapper: { borderWidth: 1, borderRadius: 8, padding: normalize(8), marginBottom: normalize(10), borderStyle: 'dashed' },
  lblMini: { fontSize: normalize(10), fontWeight: '500', marginBottom: 4 },
  chip: { paddingHorizontal: normalize(10), paddingVertical: normalize(5), borderRadius: 16, marginRight: normalize(6) },
  chipText: { fontSize: normalize(11), fontWeight: '500' },
  accountChip: { paddingHorizontal: normalize(10), paddingVertical: normalize(6), borderRadius: 8, marginRight: normalize(6), borderWidth: 1 },
  accountChipText: { fontSize: normalize(11), fontWeight: '600' },
  textWhite: { color: '#FFFFFF' },
  btnSave: { flex: 2, height: normalize(40), borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: normalize(13), fontWeight: '700' },
  btnCancel: { flex: 1, marginLeft: normalize(8), height: normalize(40), borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontSize: normalize(13), fontWeight: '600' },
  
  // Grid layout de mini-módulos corporativos
  cardRowLayout: { flexDirection: 'row', marginBottom: normalize(12) },
  cardHalf: { flex: 1, borderRadius: 12, padding: normalize(10), borderWidth: 1, elevation: 1 },
  smallCardTitle: { fontSize: normalize(12), fontWeight: '700', marginBottom: normalize(6) },
  smallInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, height: normalize(32), fontSize: normalize(12), marginBottom: normalize(6) },
  smallCardBtn: { height: normalize(28), borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  smallCardBtnText: { color: '#FFFFFF', fontSize: normalize(11), fontWeight: '700' },
  
  // Filtros Avanzados
  filterCard: { borderRadius: 12, padding: normalize(12), borderWidth: 1, marginBottom: normalize(14) },
  filterCardTitle: { fontSize: normalize(13), fontWeight: '700', marginBottom: normalize(8) },
  filterMiniRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  filterMiniBtn: { paddingHorizontal: normalize(8), paddingVertical: normalize(4), borderRadius: 6, marginRight: normalize(4), marginBottom: normalize(4) },
  filterMiniText: { fontSize: normalize(10), fontWeight: '600' },
  
  // Listas de Historial Intuitivo
  historySectionHeader: { marginBottom: normalize(8), paddingHorizontal: 2 },
  listHeaderTitle: { fontSize: normalize(15), fontWeight: '700' },
  listHeaderSubtitle: { fontSize: normalize(11), marginTop: 2 },
  badgeCount: { paddingHorizontal: normalize(8), paddingVertical: normalize(3), borderRadius: normalize(10) },
  badgeCountText: { fontSize: normalize(10), fontWeight: '700' },
  historySummaryMini: { marginTop: 2 },
  emptyHistoryBox: { borderRadius: 14, borderWidth: 1, padding: normalize(24), alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', fontSize: normalize(12), marginTop: 4 },
  btnResetFilters: { marginTop: normalize(10), paddingHorizontal: normalize(12), paddingVertical: normalize(6), borderRadius: normalize(8), borderWidth: 1 },
  
  // Tarjetas de transacción intuitivas
  txCardIntuitive: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: normalize(12), 
    borderRadius: normalize(14), 
    borderWidth: 1, 
    marginBottom: normalize(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1
  },
  txCategoryIconCircle: { 
    width: normalize(40), 
    height: normalize(40), 
    borderRadius: normalize(20), 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: normalize(10) 
  },
  txCenterDetails: { flex: 1, paddingRight: normalize(6) },
  txCategoryTitle: { fontSize: normalize(13), fontWeight: '700', marginBottom: 2 },
  txDesc: { fontSize: normalize(11), marginBottom: 4 },
  txTagsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: normalize(6) },
  txAccountPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: normalize(6), paddingVertical: normalize(2), borderRadius: normalize(6) },
  txAccountPillText: { fontSize: normalize(9), fontWeight: '700' },
  txDateText: { fontSize: normalize(10) },
  txRightCol: { alignItems: 'flex-end', justifyContent: 'center' },
  txAmountLarge: { fontSize: normalize(14), fontWeight: '800', marginBottom: normalize(4) },
  txQuickActions: { flexDirection: 'row', alignItems: 'center' },
  txMiniActionBtn: { width: normalize(26), height: normalize(26), borderRadius: normalize(6), alignItems: 'center', justifyContent: 'center' },
  
  // Modal de Ticket Recibo
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: normalize(20) },
  ticketContainer: { width: '85%', borderRadius: 4, padding: normalize(16), alignItems: 'center', elevation: 5 },
  ticketBrand: { fontSize: normalize(14), fontWeight: '900', letterSpacing: 2 },
  ticketSubtitle: { fontSize: normalize(10), marginTop: 2 },
  ticketDivider: { fontSize: normalize(12), marginVertical: normalize(4), letterSpacing: 1 },
  ticketBody: { width: '100%', marginVertical: normalize(4) },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: normalize(4) },
  ticketLabel: { fontSize: normalize(10), fontWeight: '500' },
  ticketValue: { fontSize: normalize(10), fontWeight: '700' },
  ticketCloseBtn: { marginTop: normalize(14), borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', width: '100%', paddingTop: normalize(10), alignItems: 'center' },
  ticketCloseBtnText: { fontSize: normalize(11), fontWeight: '800', color: '#475569', letterSpacing: 1 }
});