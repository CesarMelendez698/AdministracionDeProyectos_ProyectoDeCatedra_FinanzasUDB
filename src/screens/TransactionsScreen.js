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
  PixelRatio,
  FlatList
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

  // --- MODAL DE CAPTURA / EDICIÓN ---
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState('$');
  const [type, setType] = useState('expense'); 
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [description, setDescription] = useState('');
  
  // --- CALENDARIO Y SELECTORES DEL FORMULARIO ---
  const [dateObject, setDateObject] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCatSelector, setShowCatSelector] = useState(false);

  // --- MODAL DE ADMINISTRACIÓN DE CATÁLOGOS (CUENTAS Y CATEGORÍAS) ---
  const [isCatalogsModalVisible, setIsCatalogsModalVisible] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newCatName, setNewCatName] = useState('');

  // --- FILTROS Y BÚSQUEDA ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterCategory, setFilterCategory] = useState(''); 
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [showFilterDetails, setShowFilterDetails] = useState(false);
  const [filterCustomDate, setFilterCustomDate] = useState(new Date());
  const [showFilterDatePicker, setShowFilterDatePicker] = useState(false);
  const [showFilterCatSelector, setShowFilterCatSelector] = useState(false);

  // --- MODAL TICKET COMPROBANTE ---
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

  // Filtro de texto: Remueve dígitos numéricos del string
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

  const handleOpenAdd = () => {
    setEditingId(null);
    setAmount('$');
    setCategory('');
    setDescription('');
    setType('expense');
    if (displayAccounts.length > 0) setAccountId(displayAccounts[0].id);
    setDateObject(new Date());
    setShowCatSelector(false);
    setIsFormModalVisible(true);
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
    setIsFormModalVisible(true);
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
    setIsFormModalVisible(false);
  };

  const handleSave = async () => {
    const rawAmount = amount.replace('$', '');
    if (!rawAmount.trim() || !category.trim() || !description.trim() || !accountId) {
      Alert.alert('Campos vacíos', 'Asegúrate de llenar todos los datos requeridos.');
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

    // ⚡ RESPUESTA INSTANTÁNEA: Cerrar modal y limpiar campos al momento (0ms de retraso)
    const isEditing = !!editingId;
    const currentId = editingId;
    resetForm();

    if (isEditing) {
      updateTransaction(currentId, transactionData);
    } else {
      addTransaction(transactionData);
    }
  };

  const confirmDelete = (id) => {
    Alert.alert(
      'Confirmar Eliminación',
      '¿Deseas borrar permanentemente esta transacción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive', 
          onPress: () => {
            deleteTransaction(id); // Desaparece inmediatamente de la lista
          } 
        }
      ]
    );
  };

  const handleOpenTicket = (item) => {
    setSelectedTicket(item);
    setIsTicketVisible(true);
  };

  // Filtrado de transacciones
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
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
  }, [transactions, filterAccount, filterCategory, filterType, filterPeriod, filterCustomDate, searchQuery]);

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

  const hasActiveFilters = searchQuery !== '' || filterCategory !== '' || filterPeriod !== 'all' || filterType !== 'all' || filterAccount !== 'all';

  const resetAllFilters = () => {
    setSearchQuery('');
    setFilterCategory('');
    setFilterPeriod('all');
    setFilterType('all');
    setFilterAccount('all');
    setShowFilterCatSelector(false);
  };

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

  // --- RENDER DE ELEMENTO DEL HISTORIAL ---
  const renderTransactionItem = ({ item }) => {
    const currentAccountName = displayAccounts.find(a => a.id === item.accountId)?.name || 'General';
    const meta = getCategoryMeta(item.category, item.type);
    const isIncome = item.type === 'income';

    return (
      <TouchableOpacity 
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
  };

  // --- HEADER SUPERIOR (TARJETA EJECUTIVA DE BALANCE + FILTROS INTELIGENTES) ---
  const renderListHeader = () => {
    return (
      <View style={{ marginBottom: normalize(10) }}>
        {/* 1. TARJETA RESUMEN EJECUTIVA DE BALANCE */}
        <View style={[styles.summaryCardHero, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.summaryTopRow}>
            <View>
              <Text style={[styles.summaryOverline, { color: theme.textSecondary }]}>BALANCE DEL FILTRO</Text>
              <Text style={[
                styles.summaryNetText,
                { color: filteredTotals.net >= 0 ? '#10B981' : '#EF4444' }
              ]}>
                {filteredTotals.net >= 0 ? '+' : ''}${filteredTotals.net.toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.btnManageCatalogs, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.border }]}
              onPress={() => setIsCatalogsModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="options-outline" size={normalize(14)} color={theme.accent} />
              <Text style={[styles.btnManageCatalogsText, { color: theme.textPrimary }]}>Cuentas</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]} />

          <View style={styles.summaryBreakdownRow}>
            {/* Ingresos */}
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownIconCircle, { backgroundColor: isDarkMode ? '#064E3B40' : '#D1FAE5' }]}>
                <Ionicons name="arrow-down" size={normalize(12)} color="#10B981" />
              </View>
              <View>
                <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Ingresos</Text>
                <Text style={[styles.breakdownValue, { color: '#10B981' }]}>+${filteredTotals.income.toFixed(2)}</Text>
              </View>
            </View>

            {/* Separador vertical */}
            <View style={[styles.breakdownSeparator, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]} />

            {/* Gastos */}
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownIconCircle, { backgroundColor: isDarkMode ? '#450A0A40' : '#FEE2E2' }]}>
                <Ionicons name="arrow-up" size={normalize(12)} color="#EF4444" />
              </View>
              <View>
                <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Gastos</Text>
                <Text style={[styles.breakdownValue, { color: '#EF4444' }]}>-${filteredTotals.expense.toFixed(2)}</Text>
              </View>
            </View>

            {/* Separador vertical */}
            <View style={[styles.breakdownSeparator, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]} />

            {/* Total de registros */}
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownIconCircle, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
                <Ionicons name="receipt-outline" size={normalize(12)} color={theme.accent} />
              </View>
              <View>
                <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Movs.</Text>
                <Text style={[styles.breakdownValue, { color: theme.textPrimary }]}>{filteredTotals.count}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. BARRA DE BÚSQUEDA Y FILTROS RÁPIDOS */}
        <View style={[styles.searchFilterCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Input de Búsqueda */}
          <View style={[styles.searchBarBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={normalize(16)} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder="Buscar por concepto, categoría o monto..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={normalize(16)} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity 
              style={[styles.btnToggleFilterDetails, showFilterDetails && { backgroundColor: theme.accent }]}
              onPress={() => setShowFilterDetails(!showFilterDetails)}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={showFilterDetails ? "funnel" : "funnel-outline"} 
                size={normalize(14)} 
                color={showFilterDetails ? '#FFFFFF' : theme.accent} 
              />
            </TouchableOpacity>
          </View>

          {/* Chips de tipo de movimiento */}
          <View style={styles.quickPillsRow}>
            {['all', 'expense', 'income'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.quickPill,
                  { backgroundColor: isDarkMode ? theme.background : '#F1F5F9', borderColor: theme.border },
                  filterType === t && { backgroundColor: theme.accent, borderColor: theme.accent }
                ]}
                onPress={() => setFilterType(t)}
              >
                <Text style={[
                  styles.quickPillText,
                  { color: theme.textSecondary },
                  filterType === t && styles.textWhite
                ]}>
                  {t === 'all' ? 'Todos' : t === 'expense' ? 'Gastos' : 'Ingresos'}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={{ width: 1, height: normalize(18), backgroundColor: theme.border, marginHorizontal: normalize(4) }} />

            {/* Chips de período */}
            {['all', 'today', 'current_month', 'custom'].map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.quickPill,
                  { backgroundColor: isDarkMode ? theme.background : '#F1F5F9', borderColor: theme.border },
                  filterPeriod === p && { backgroundColor: theme.accent, borderColor: theme.accent }
                ]}
                onPress={() => setFilterPeriod(p)}
              >
                <Text style={[
                  styles.quickPillText,
                  { color: theme.textSecondary },
                  filterPeriod === p && styles.textWhite
                ]}>
                  {p === 'all' ? 'Todo' : p === 'today' ? 'Hoy' : p === 'current_month' ? 'Mes' : 'Fecha 📅'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Si se presiona Fecha personalizada */}
          {filterPeriod === 'custom' && (
            <View style={{ marginTop: normalize(8), paddingTop: normalize(6), borderTopWidth: 1, borderTopColor: theme.border }}>
              <TouchableOpacity
                style={[
                  styles.customSelectTrigger,
                  { backgroundColor: theme.background, borderColor: theme.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
                ]}
                onPress={() => setShowFilterDatePicker(true)}
              >
                <Text style={{ fontSize: normalize(12), color: theme.textPrimary, fontWeight: '600' }}>
                  📅 Filtrando fecha: {getDisplayDateString(filterCustomDate)}
                </Text>
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

          {/* Opciones avanzadas de filtro: Categorías y Cuentas (desplegables) */}
          {showFilterDetails && (
            <View style={{ marginTop: normalize(8), paddingTop: normalize(8), borderTopWidth: 1, borderTopColor: theme.border }}>
              {/* Filtro de Cuentas */}
              <Text style={[styles.filterGroupLabel, { color: theme.textSecondary }]}>Filtrar por Cuenta:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: normalize(8) }}>
                <TouchableOpacity
                  style={[
                    styles.quickPill,
                    { backgroundColor: isDarkMode ? theme.background : '#F1F5F9', borderColor: theme.border },
                    filterAccount === 'all' && { backgroundColor: theme.accent, borderColor: theme.accent }
                  ]}
                  onPress={() => setFilterAccount('all')}
                >
                  <Text style={[styles.quickPillText, { color: theme.textSecondary }, filterAccount === 'all' && styles.textWhite]}>
                    Todas las cuentas
                  </Text>
                </TouchableOpacity>
                {displayAccounts.map(acc => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.quickPill,
                      { backgroundColor: isDarkMode ? theme.background : '#F1F5F9', borderColor: theme.border },
                      filterAccount === acc.id && { backgroundColor: theme.accent, borderColor: theme.accent }
                    ]}
                    onPress={() => setFilterAccount(acc.id)}
                  >
                    <Text style={[styles.quickPillText, { color: theme.textSecondary }, filterAccount === acc.id && styles.textWhite]}>
                      💳 {acc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Filtro de Categoría */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: normalize(4) }}>
                <Text style={[styles.filterGroupLabel, { color: theme.textSecondary, marginBottom: 0 }]}>Filtrar por Categoría:</Text>
                {filterCategory !== '' && (
                  <TouchableOpacity onPress={() => setFilterCategory('')}>
                    <Text style={{ fontSize: normalize(10), color: '#EF4444', fontWeight: '700' }}>Quitar categoría ✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity 
                style={[
                  styles.customSelectTrigger, 
                  { backgroundColor: theme.background, borderColor: theme.border },
                  filterCategory !== '' && { borderColor: theme.accent, borderWidth: 1.5 }
                ]}
                onPress={() => setShowFilterCatSelector(!showFilterCatSelector)}
              >
                <Text style={[styles.selectTriggerText, { color: filterCategory ? theme.textPrimary : theme.textSecondary }]} numberOfLines={1}>
                  {filterCategory || 'Todas las categorías (Toca para elegir)'}
                </Text>
              </TouchableOpacity>

              {showFilterCatSelector && (
                <View style={[styles.selectorWrapper, { borderColor: theme.border, marginTop: normalize(6) }]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                    {(allCategories || []).map((cat, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.chip,
                          { backgroundColor: isDarkMode ? theme.background : '#E2E8F0' },
                          filterCategory.toLowerCase() === cat.toLowerCase() && { backgroundColor: theme.accent }
                        ]}
                        onPress={() => { setFilterCategory(cat); setShowFilterCatSelector(false); }}
                      >
                        <Text style={[styles.chipText, { color: theme.textPrimary }, filterCategory.toLowerCase() === cat.toLowerCase() && styles.textWhite]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Botón para reiniciar filtros si hay alguno activo */}
          {hasActiveFilters && (
            <TouchableOpacity 
              style={[styles.btnResetPill, { borderColor: theme.border }]} 
              onPress={resetAllFilters}
            >
              <Ionicons name="refresh-outline" size={normalize(12)} color={theme.accent} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: normalize(10), color: theme.accent, fontWeight: '700' }}>
                Limpiar todos los filtros
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 3. TÍTULO DEL HISTORIAL */}
        <View style={styles.historySectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.listHeaderTitle, { color: theme.textPrimary }]}>
              Historial de Movimientos
            </Text>
            <View style={[styles.badgeCount, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
              <Text style={[styles.badgeCountText, { color: theme.textSecondary }]}>
                {filteredTotals.count} {filteredTotals.count === 1 ? 'registro' : 'registros'}
              </Text>
            </View>
          </View>
          <Text style={[styles.listHeaderSubtitle, { color: theme.textSecondary }]}>
            Toca cualquier transacción para ver su comprobante detallado
          </Text>
        </View>
      </View>
    );
  };

  // --- VISTA CUANDO NO HAY RESULTADOS ---
  const renderEmptyList = () => {
    return (
      <View style={[styles.emptyHistoryBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="receipt-outline" size={normalize(38)} color={theme.textSecondary} style={{ marginBottom: 8 }} />
        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No hay movimientos</Text>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          {hasActiveFilters 
            ? 'No se encontraron resultados con los filtros actuales.' 
            : 'Aún no tienes movimientos registrados.'}
        </Text>
        
        {hasActiveFilters ? (
          <TouchableOpacity
            style={[styles.btnEmptyAction, { backgroundColor: theme.accent }]}
            onPress={resetAllFilters}
            activeOpacity={0.85}
          >
            <Text style={styles.btnEmptyActionText}>Limpiar Filtros</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btnEmptyAction, { backgroundColor: theme.accent }]}
            onPress={handleOpenAdd}
            activeOpacity={0.85}
          >
            <Text style={styles.btnEmptyActionText}>＋ Registrar Primer Movimiento</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <View style={{ flex: 1 }}>
        {/* LISTA VIRTUALIZADA FLUIDA (FLATLIST) */}
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTransactionItem}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={[styles.listContent, { backgroundColor: theme.background }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* BOTÓN FLOTANTE (FAB) PARA REGISTRAR NUEVA TRANSACCIÓN */}
        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: theme.accent }]}
          onPress={handleOpenAdd}
          activeOpacity={0.9}
        >
          <Ionicons name="add" size={normalize(26)} color="#FFFFFF" />
          <Text style={styles.fabText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* ============================================================== */}
      {/* MODAL 1: FORMULARIO MODERNO DE REGISTRO / EDICIÓN DE MOVIMIENTO */}
      {/* ============================================================== */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isFormModalVisible}
        onRequestClose={resetForm}
      >
        <View style={styles.formModalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.formModalKeyboardWrapper}
          >
            <View style={[styles.formModalSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {/* Header del Modal */}
              <View style={styles.formModalHeader}>
                <View>
                  <Text style={[styles.formModalTitle, { color: theme.textPrimary }]}>
                    {editingId ? '✏️ Editar Movimiento' : '➕ Capturar Transacción'}
                  </Text>
                  <Text style={[styles.formModalSubtitle, { color: theme.textSecondary }]}>
                    {editingId ? 'Modifica los datos del registro seleccionado' : 'Ingresa los detalles de tu ingreso o gasto'}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[styles.modalCloseIconBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}
                  onPress={resetForm}
                >
                  <Ionicons name="close" size={normalize(18)} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={false} 
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: Dimensions.get('window').height * 0.72 }}
              >
                {/* Selector Tipo: Gasto / Ingreso */}
                <View style={[styles.typeSelectorRow, { backgroundColor: isDarkMode ? theme.background : '#F1F5F9' }]}>
                  <TouchableOpacity 
                    style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpenseActive]} 
                    onPress={() => setType('expense')}
                  >
                    <Text style={[styles.typeBtnText, { color: type === 'expense' ? '#FFFFFF' : theme.textSecondary }]}>
                      🔴 Gasto
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.typeBtn, type === 'income' && styles.typeBtnIncomeActive]} 
                    onPress={() => setType('income')}
                  >
                    <Text style={[styles.typeBtnText, { color: type === 'income' ? '#FFFFFF' : theme.textSecondary }]}>
                      🟢 Ingreso
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Monto & Categoría */}
                <View style={styles.row}>
                  <View style={{ flex: 1.1, marginRight: normalize(8) }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Monto ($)</Text>
                    <TextInput 
                      style={[styles.inputAmountHero, { backgroundColor: theme.background, color: theme.textPrimary, borderColor: theme.border }]} 
                      placeholder="$0.00" 
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric" 
                      value={amount} 
                      onChangeText={handleAmountChange} 
                    />
                  </View>
                  
                  <View style={{ flex: 1.2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Categoría</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowCatSelector(!showCatSelector)} activeOpacity={0.8}>
                      <View style={[
                        styles.customSelectTrigger, 
                        { backgroundColor: theme.background, borderColor: theme.border },
                        category !== '' && { borderColor: theme.accent, borderWidth: 1.5 }
                      ]}>
                        <Text style={[
                          styles.selectTriggerText, 
                          { color: theme.textSecondary },
                          category !== '' && { color: theme.textPrimary, fontWeight: '600' }
                        ]} numberOfLines={1}>
                          {category || 'Seleccionar 🔍'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Selector Desplegable de Categorías */}
                {showCatSelector && (
                  <View style={[styles.selectorWrapper, { borderColor: theme.border }]}>
                    <Text style={[styles.lblMini, { color: theme.textSecondary }]}>
                      Elige una categoría existente (Mantén para eliminar):
                    </Text>
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

                {/* Fecha y Hora */}
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: normalize(8) }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Fecha</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
                      <View style={[styles.customSelectTrigger, { backgroundColor: theme.background, borderColor: showDatePicker ? theme.accent : theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                        <Text style={{ fontSize: normalize(12), color: theme.textPrimary, fontWeight: '500' }}>
                          {getDisplayDateString(dateObject)}
                        </Text>
                        <Ionicons name="calendar-outline" size={normalize(15)} color={theme.accent} />
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Hora</Text>
                    <TouchableOpacity onPress={() => setShowTimePicker(true)} activeOpacity={0.8}>
                      <View style={[styles.customSelectTrigger, { backgroundColor: theme.background, borderColor: showTimePicker ? theme.accent : theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                        <Text style={{ fontSize: normalize(12), color: theme.textPrimary, fontWeight: '500' }}>
                          {getDisplayTimeString(dateObject)}
                        </Text>
                        <Ionicons name="time-outline" size={normalize(15)} color={theme.accent} />
                      </View>
                    </TouchableOpacity>
                  </View>
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

                {/* Descripción */}
                <View style={{ marginBottom: normalize(10) }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Descripción / Concepto</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: theme.background, color: theme.textPrimary, borderColor: theme.border }]} 
                    placeholder="Ej. Almuerzo, Transporte UDB, Salida..." 
                    placeholderTextColor={theme.textSecondary}
                    value={description} 
                    onChangeText={(text) => handleTextOnlyChange(text, setDescription)} 
                  />
                </View>

                {/* Cuenta Origen/Destino */}
                <View style={{ marginBottom: normalize(14) }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary, marginBottom: 0 }]}>Cuenta asignada:</Text>
                    <TouchableOpacity onPress={() => setIsCatalogsModalVisible(true)}>
                      <Text style={{ fontSize: normalize(10), color: theme.accent, fontWeight: '700' }}>＋ Nueva cuenta</Text>
                    </TouchableOpacity>
                  </View>

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

                {/* Botones del Formulario */}
                <View style={[styles.row, { marginTop: normalize(6) }]}>
                  <TouchableOpacity 
                    style={[styles.btnSave, { backgroundColor: editingId ? '#F59E0B' : theme.accent }]} 
                    onPress={handleSave}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.btnText}>
                      {editingId ? 'Guardar Cambios' : 'Registrar Movimiento'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.btnCancel, { borderColor: theme.border }]} 
                    onPress={resetForm}
                  >
                    <Text style={[styles.btnCancelText, { color: theme.textSecondary }]}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 2: GESTIÓN DEDICADA DE CUENTAS Y CATEGORÍAS */}
      {/* ============================================================== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isCatalogsModalVisible}
        onRequestClose={() => setIsCatalogsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.catalogsBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.catalogsHeader}>
              <Text style={[styles.catalogsTitle, { color: theme.textPrimary }]}>⚙️ Cuentas y Categorías</Text>
              <TouchableOpacity onPress={() => setIsCatalogsModalVisible(false)}>
                <Ionicons name="close" size={normalize(20)} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: Dimensions.get('window').height * 0.65 }}>
              {/* Sección Crear Cuenta */}
              <View style={[styles.catalogSectionCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={[styles.catalogSectionTitle, { color: theme.textPrimary }]}>💳 Agregar Cuenta Bancaria o Billetera</Text>
                <View style={{ flexDirection: 'row', gap: normalize(6), marginTop: normalize(4) }}>
                  <TextInput 
                    style={[styles.smallInput, { flex: 1, backgroundColor: theme.card, color: theme.textPrimary, borderColor: theme.border }]} 
                    placeholder="Ej. Débito UDB, Ahorros..." 
                    placeholderTextColor={theme.textSecondary}
                    value={newAccountName} 
                    onChangeText={setNewAccountName} 
                    autoCapitalize="sentences"
                  />
                  <TouchableOpacity 
                    style={[styles.smallCardBtn, { backgroundColor: theme.accent, paddingHorizontal: normalize(12) }]} 
                    onPress={() => {
                      if (!newAccountName.trim()) return;
                      addAccount(newAccountName.trim());
                      setNewAccountName('');
                      Alert.alert('Éxito', 'Cuenta creada con éxito.');
                    }}
                  >
                    <Text style={styles.smallCardBtnText}>Crear</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: normalize(9), color: theme.textSecondary, marginTop: 4 }}>
                  Tip: Para borrar una cuenta personalizada, manténla presionada en el formulario.
                </Text>
              </View>

              {/* Sección Crear Categoría */}
              <View style={[styles.catalogSectionCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={[styles.catalogSectionTitle, { color: theme.textPrimary }]}>🏷️ Agregar Nueva Categoría</Text>
                <View style={{ flexDirection: 'row', gap: normalize(6), marginTop: normalize(4) }}>
                  <TextInput 
                    style={[styles.smallInput, { flex: 1, backgroundColor: theme.card, color: theme.textPrimary, borderColor: theme.border }]} 
                    placeholder="Ej. Gimnasio, Libros..." 
                    placeholderTextColor={theme.textSecondary}
                    value={newCatName} 
                    onChangeText={(text) => handleTextOnlyChange(text, setNewCatName)} 
                    autoCapitalize="sentences"
                  />
                  <TouchableOpacity 
                    style={[styles.smallCardBtn, { backgroundColor: '#6366F1', paddingHorizontal: normalize(12) }]} 
                    onPress={handleCreateCategory}
                  >
                    <Text style={styles.smallCardBtnText}>Añadir</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: normalize(9), color: theme.textSecondary, marginTop: 4 }}>
                  Tip: Para borrar una categoría personalizada, manténla presionada en el selector.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.btnDoneCatalogs, { backgroundColor: theme.accent }]} 
              onPress={() => setIsCatalogsModalVisible(false)}
            >
              <Text style={styles.btnDoneCatalogsText}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 3: RECIBO MINIMALISTA ESTILO TICKET */}
      {/* ============================================================== */}
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
                  <Text style={{ fontSize: normalize(15), fontWeight: 'bold', color: '#0F172A' }}>TOTAL:</Text>
                  <Text style={{ fontSize: normalize(18), fontWeight: 'bold', color: selectedTicket.type === 'income' ? '#10B981' : '#EF4444' }}>
                    ${Number(selectedTicket.amount || 0).toFixed(2)}
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

// --- ESTILOS VISUALES Y ARQUITECTURA DE DISEÑO ---
const styles = StyleSheet.create({
  listContent: { 
    paddingHorizontal: normalize(14), 
    paddingTop: normalize(10), 
    paddingBottom: normalize(85) 
  },

  // 1. TARJETA EJECUTIVA DE BALANCE
  summaryCardHero: {
    borderRadius: normalize(14),
    padding: normalize(14),
    borderWidth: 1,
    marginBottom: normalize(10),
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  summaryOverline: {
    fontSize: normalize(9),
    fontWeight: '700',
    letterSpacing: 0.8
  },
  summaryNetText: {
    fontSize: normalize(22),
    fontWeight: '800',
    marginTop: 2
  },
  btnManageCatalogs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(6),
    borderRadius: normalize(20),
    borderWidth: 1,
    gap: normalize(4)
  },
  btnManageCatalogsText: {
    fontSize: normalize(11),
    fontWeight: '600'
  },
  summaryDivider: {
    height: 1,
    marginVertical: normalize(10)
  },
  summaryBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(6)
  },
  breakdownIconCircle: {
    width: normalize(24),
    height: normalize(24),
    borderRadius: normalize(12),
    alignItems: 'center',
    justifyContent: 'center'
  },
  breakdownLabel: {
    fontSize: normalize(9),
    fontWeight: '500'
  },
  breakdownValue: {
    fontSize: normalize(11),
    fontWeight: '700'
  },
  breakdownSeparator: {
    width: 1,
    height: normalize(22)
  },

  // 2. BUSCADOR Y FILTROS COMPACTOS
  searchFilterCard: {
    borderRadius: normalize(12),
    padding: normalize(10),
    borderWidth: 1,
    marginBottom: normalize(12)
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: normalize(8),
    paddingHorizontal: normalize(10),
    height: normalize(36),
    gap: normalize(6)
  },
  searchInput: {
    flex: 1,
    fontSize: normalize(12),
    height: '100%'
  },
  btnToggleFilterDetails: {
    width: normalize(26),
    height: normalize(26),
    borderRadius: normalize(6),
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: normalize(8),
    gap: normalize(4)
  },
  quickPill: {
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(14),
    borderWidth: 1
  },
  quickPillText: {
    fontSize: normalize(10),
    fontWeight: '600'
  },
  filterGroupLabel: {
    fontSize: normalize(10),
    fontWeight: '600',
    marginBottom: 4
  },
  btnResetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: normalize(8),
    paddingVertical: normalize(5),
    borderRadius: normalize(6),
    borderWidth: 1,
    borderStyle: 'dashed'
  },

  // 3. CABECERA HISTORIAL
  historySectionHeader: {
    marginBottom: normalize(6),
    paddingHorizontal: 2
  },
  listHeaderTitle: {
    fontSize: normalize(14),
    fontWeight: '800'
  },
  listHeaderSubtitle: {
    fontSize: normalize(10),
    marginTop: 1
  },
  badgeCount: {
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(2),
    borderRadius: normalize(10)
  },
  badgeCountText: {
    fontSize: normalize(9),
    fontWeight: '700'
  },

  // 4. TARJETA DE TRANSACCIÓN
  txCardIntuitive: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: normalize(11), 
    borderRadius: normalize(12), 
    borderWidth: 1, 
    marginBottom: normalize(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1
  },
  txCategoryIconCircle: { 
    width: normalize(38), 
    height: normalize(38), 
    borderRadius: normalize(19), 
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

  // 5. BOTÓN FLOTANTE (FAB)
  fabButton: {
    position: 'absolute',
    bottom: normalize(18),
    right: normalize(16),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: normalize(14),
    paddingVertical: normalize(10),
    borderRadius: normalize(26),
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    gap: normalize(4)
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: normalize(12),
    fontWeight: '700'
  },

  // 6. ESTADOS VACÍOS
  emptyHistoryBox: { 
    borderRadius: normalize(12), 
    borderWidth: 1, 
    padding: normalize(22), 
    alignItems: 'center', 
    justifyContent: 'center',
    marginVertical: normalize(10)
  },
  emptyTitle: {
    fontSize: normalize(14),
    fontWeight: '700',
    marginBottom: 4
  },
  emptyText: { 
    textAlign: 'center', 
    fontSize: normalize(11), 
    marginBottom: normalize(12) 
  },
  btnEmptyAction: {
    paddingHorizontal: normalize(14),
    paddingVertical: normalize(8),
    borderRadius: normalize(8)
  },
  btnEmptyActionText: {
    color: '#FFFFFF',
    fontSize: normalize(11),
    fontWeight: '700'
  },

  // 7. MODAL DE FORMULARIO DE CAPTURA / EDICIÓN
  formModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end'
  },
  formModalKeyboardWrapper: {
    width: '100%'
  },
  formModalSheet: {
    borderTopLeftRadius: normalize(20),
    borderTopRightRadius: normalize(20),
    paddingHorizontal: normalize(16),
    paddingTop: normalize(14),
    paddingBottom: normalize(24),
    borderWidth: 1,
    elevation: 10
  },
  formModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: normalize(12)
  },
  formModalTitle: {
    fontSize: normalize(16),
    fontWeight: '800'
  },
  formModalSubtitle: {
    fontSize: normalize(11),
    marginTop: 2
  },
  modalCloseIconBtn: {
    width: normalize(28),
    height: normalize(28),
    borderRadius: normalize(14),
    alignItems: 'center',
    justifyContent: 'center'
  },
  typeSelectorRow: { 
    flexDirection: 'row', 
    borderRadius: 8, 
    padding: 3, 
    marginBottom: normalize(12) 
  },
  typeBtn: { 
    flex: 1, 
    paddingVertical: normalize(8), 
    alignItems: 'center', 
    borderRadius: 6 
  },
  typeBtnExpenseActive: { backgroundColor: '#EF4444' },
  typeBtnIncomeActive: { backgroundColor: '#10B981' },
  typeBtnText: { fontSize: normalize(12), fontWeight: '700' },
  row: { flexDirection: 'row', marginBottom: normalize(10), alignItems: 'flex-end' },
  inputLabel: { fontSize: normalize(11), fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: normalize(10), height: normalize(38), fontSize: normalize(12) },
  inputAmountHero: { 
    borderWidth: 1, 
    borderRadius: 8, 
    paddingHorizontal: normalize(10), 
    height: normalize(38), 
    fontSize: normalize(15), 
    fontWeight: '700' 
  },
  customSelectTrigger: { borderWidth: 1, borderRadius: 8, paddingHorizontal: normalize(10), height: normalize(38), justifyContent: 'center' },
  selectTriggerText: { fontSize: normalize(12) },
  selectorWrapper: { borderWidth: 1, borderRadius: 8, padding: normalize(8), marginBottom: normalize(10), borderStyle: 'dashed' },
  lblMini: { fontSize: normalize(10), fontWeight: '500', marginBottom: 4 },
  chip: { paddingHorizontal: normalize(10), paddingVertical: normalize(5), borderRadius: 16, marginRight: normalize(6) },
  chipText: { fontSize: normalize(11), fontWeight: '500' },
  accountChip: { paddingHorizontal: normalize(10), paddingVertical: normalize(6), borderRadius: 8, marginRight: normalize(6), borderWidth: 1 },
  accountChipText: { fontSize: normalize(11), fontWeight: '600' },
  textWhite: { color: '#FFFFFF' },
  btnSave: { flex: 2, height: normalize(40), borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: normalize(12), fontWeight: '700' },
  btnCancel: { flex: 1, marginLeft: normalize(8), height: normalize(40), borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontSize: normalize(12), fontWeight: '600' },

  // 8. MODAL DE CATÁLOGOS (CUENTAS Y CATEGORÍAS)
  catalogsBox: {
    width: '90%',
    borderRadius: normalize(14),
    padding: normalize(16),
    borderWidth: 1,
    elevation: 6
  },
  catalogsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(12)
  },
  catalogsTitle: {
    fontSize: normalize(15),
    fontWeight: '800'
  },
  catalogSectionCard: {
    borderRadius: normalize(10),
    padding: normalize(10),
    borderWidth: 1,
    marginBottom: normalize(10)
  },
  catalogSectionTitle: {
    fontSize: normalize(11),
    fontWeight: '700'
  },
  smallInput: { 
    borderWidth: 1, 
    borderRadius: 6, 
    paddingHorizontal: 8, 
    height: normalize(34), 
    fontSize: normalize(11) 
  },
  smallCardBtn: { 
    height: normalize(34), 
    borderRadius: 6, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  smallCardBtnText: { color: '#FFFFFF', fontSize: normalize(11), fontWeight: '700' },
  btnDoneCatalogs: {
    marginTop: normalize(8),
    height: normalize(36),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnDoneCatalogsText: {
    color: '#FFFFFF',
    fontSize: normalize(12),
    fontWeight: '700'
  },

  // 9. MODAL RECIBO TICKET
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