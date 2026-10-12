import React, { createContext, useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  Dimensions, 
  PixelRatio, 
  TouchableOpacity, 
  Platform, 
  StatusBar 
} from 'react-native';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { AuthContext } from './AuthContext';
import { db } from '../config/firebase';
import * as NavigationService from '../utils/NavigationService'; 

export const FinanceContext = createContext();

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

// Calcula el espacio seguro en el tope de la pantalla dependiendo del sistema operativo
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? normalize(44) : StatusBar.currentHeight || normalize(30);

const defaultCategories = ['Alimentación', 'Transporte', 'Estudios UDB', 'Servicios', 'Entretenimiento', 'Salud'];

export const FinanceProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [customCategories, setCustomCategories] = useState([]); 

  // 🚨 REF PERSISTENTE GLOBAL: Evita duplicar disparos en el ciclo de vida
  const globalAlertsRef = useRef({});

  // ─── ESTADOS Y ANIMACIÓN PARA LA NOTIFICACIÓN IN-APP ───
  const [toast, setToast] = useState({ visible: false, title: '', message: '', type: 'info' });
  const animatedValue = useRef(new Animated.Value(-normalize(150))).current; 
  const timerRef = useRef(null);

  // Función para mostrar la notificación animada
  const showGlobalNotification = useCallback((title, message, type = 'info') => {
    if (timerRef.current) clearTimeout(timerRef.current);

    setToast({ visible: true, title, message, type });

    Animated.spring(animatedValue, {
      toValue: STATUSBAR_HEIGHT + normalize(10),
      useNativeDriver: true,
      tension: 20,
      friction: 6,
    }).start();

    timerRef.current = setTimeout(() => {
      dismissNotification();
    }, 7000);
  }, [animatedValue]);

  // Función para ocultar la notificación
  const dismissNotification = useCallback(() => {
    Animated.timing(animatedValue, {
      toValue: -normalize(150), 
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      setToast(prev => ({ ...prev, visible: false }));
    });
  }, [animatedValue]);

  // Redirección directa al presionar el Banner
  const handleToastPress = useCallback(() => {
    dismissNotification(); 
    NavigationService.navigate('Presupuestos'); 
  }, [dismissNotification]);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setAccounts([]);
      setBudgets([]);
      setCustomCategories([]);
      globalAlertsRef.current = {};
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const unsubscribes = [];

    // 1. Escucha de Transacciones
    const qTransactions = query(collection(db, 'transactions'), where('userId', '==', user.email));
    unsubscribes.push(onSnapshot(qTransactions, (snapshot) => {
      const txList = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      txList.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(txList);
    }));

    // 2. Escucha de Cuentas
    const qAccounts = query(collection(db, 'accounts'), where('userId', '==', user.email));
    unsubscribes.push(onSnapshot(qAccounts, async (snapshot) => {
      const accList = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      if (accList.length === 0 && !snapshot.metadata.fromCache) {
        const defaultAccounts = ['Efectivo', 'Tarjeta de Crédito', 'Cuenta Banco'];
        Promise.all(defaultAccounts.map(name => 
          addDoc(collection(db, 'accounts'), { name, userId: user.email })
        )).catch(err => console.log("Error creando cuentas iniciales:", err));
      } else {
        setAccounts(accList);
      }
    }));

    // 3. Escucha de Presupuestos
    const qBudgets = query(collection(db, 'budgets'), where('userId', '==', user.email));
    unsubscribes.push(onSnapshot(qBudgets, (snapshot) => {
      setBudgets(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    }));

    // 4. Escucha activa de Categorías Personalizadas
    const qCategories = query(collection(db, 'categories'), where('userId', '==', user.email));
    unsubscribes.push(onSnapshot(qCategories, (snapshot) => {
      const categoriesArr = snapshot.docs.map(docSnap => ({ id: docSnap.id, name: docSnap.data().name }));
      setCustomCategories(categoriesArr); 
    }));

    return () => {
      unsubscribes.forEach(unsub => unsub());
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user]);

  // --- 🔊 MONITOR GLOBAL DE PRESUPUESTOS (ALTA EFICIENCIA O(N)) ---
  useEffect(() => {
    if (!budgets || budgets.length === 0) return;

    const currentYearMonth = new Date().toISOString().slice(0, 7);
    const spentMap = {};

    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (t && t.type === 'expense' && t.category && t.date && t.date.startsWith(currentYearMonth)) {
        const catKey = t.category.trim().toLowerCase();
        spentMap[catKey] = (spentMap[catKey] || 0) + Number(t.amount || 0);
      }
    }

    budgets.forEach(b => {
      if (!b.category || !b.monthlyLimit) return;

      const categoryClean = b.category.trim().toLowerCase();
      const limitValue = Number(b.monthlyLimit);

      if (limitValue <= 0) return;

      const spent = spentMap[categoryClean] || 0;
      const percentage = (spent / limitValue) * 100;

      if (!globalAlertsRef.current[categoryClean]) {
        globalAlertsRef.current[categoryClean] = { warned80: false, warned100: false };
      }

      const alertStatus = globalAlertsRef.current[categoryClean];

      if (percentage >= 100 && !alertStatus.warned100) {
        showGlobalNotification(
          '🚨 LÍMITE EXCEDIDO (100%)',
          `Gastos en "${b.category}" ($${spent.toFixed(2)}) superaron tu límite de $${limitValue.toFixed(2)}. ¡Toca para revisar!`,
          'danger'
        );
        globalAlertsRef.current[categoryClean].warned100 = true;
      } 
      else if (percentage >= 80 && percentage < 100 && !alertStatus.warned80) {
        showGlobalNotification(
          '⚠️ ALERTA DE PRESUPUESTO (80%)',
          `Has consumido más del 80% en "${b.category}". Llevas: $${spent.toFixed(2)} de $${limitValue.toFixed(2)}. ¡Toca para revisar!`,
          'warning'
        );
        globalAlertsRef.current[categoryClean].warned80 = true;
      }

      if (percentage < 80) {
        globalAlertsRef.current[categoryClean].warned80 = false;
        globalAlertsRef.current[categoryClean].warned100 = false;
      } else if (percentage >= 80 && percentage < 100) {
        globalAlertsRef.current[categoryClean].warned100 = false;
      }
    });
  }, [transactions, budgets, showGlobalNotification]);

  // --- MÉTODOS DE BASE DE DATOS CON ACTUALIZACIÓN OPTIMISTA INMEDIATA (0MS LAG) ---

  const addCustomCategory = useCallback(async (categoryName) => {
    if (!categoryName || !categoryName.trim() || !user?.email) return { success: false, message: 'Nombre vacío' };
    const nameTrimmed = categoryName.trim();
    const customNames = customCategories.map(c => c.name.toLowerCase());
    const allNames = [...defaultCategories.map(c => c.toLowerCase()), ...customNames];
    if (allNames.includes(nameTrimmed.toLowerCase())) return { success: false, message: 'La categoría ya existe.' };

    const tempId = `temp_cat_${Date.now()}`;
    // Actualización instantánea en UI
    setCustomCategories(prev => [...prev, { id: tempId, name: nameTrimmed }]);

    try {
      await addDoc(collection(db, 'categories'), { name: nameTrimmed, userId: user.email });
      return { success: true };
    } catch (error) {
      setCustomCategories(prev => prev.filter(c => c.id !== tempId));
      return { success: false, message: 'Error al guardar.' };
    }
  }, [user, customCategories]);

  const deleteCustomCategory = useCallback(async (categoryId) => {
    // Quitar inmediatamente de la UI
    setCustomCategories(prev => prev.filter(c => c.id !== categoryId));
    try { 
      await deleteDoc(doc(db, 'categories', categoryId)); 
    } catch (error) { 
      console.error(error); 
    }
  }, []);

  const allCategories = useMemo(() => {
    return [...defaultCategories, ...customCategories.map(c => c.name)];
  }, [customCategories]);

  const getMonthSummary = useCallback((transactionsList) => {
    const safeList = Array.isArray(transactionsList) ? transactionsList : transactions;
    const currentMonth = new Date().toISOString().slice(0, 7);
    let income = 0;
    let expense = 0;
    for (let i = 0; i < safeList.length; i++) {
      const t = safeList[i];
      if (t && t.date && t.date.startsWith(currentMonth)) {
        const amt = Number(t.amount || 0);
        if (t.type === 'income') income += amt;
        else if (t.type === 'expense') expense += amt;
      }
    }
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const getAccountBalances = useCallback(() => {
    const balances = {};
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (!t || !t.accountId) continue;
      const amt = Number(t.amount || 0);
      if (!balances[t.accountId]) balances[t.accountId] = 0;
      if (t.type === 'income') balances[t.accountId] += amt;
      else if (t.type === 'expense') balances[t.accountId] -= amt;
    }
    return accounts.map(account => ({
      ...account,
      balance: balances[account.id] || 0
    }));
  }, [accounts, transactions]);

  // Transacciones: respuesta inmediata en UI (Optimistic update)
  const addTransaction = useCallback(async (data) => { 
    if (!user?.email) return;
    const tempId = `temp_tx_${Date.now()}`;
    const newTx = { id: tempId, ...data, userId: user.email };
    
    // Inserción instantánea sin esperar a la nube
    setTransactions(prev => [newTx, ...prev]);

    try {
      await addDoc(collection(db, 'transactions'), { ...data, userId: user.email }); 
    } catch (e) {
      console.warn('Error guardando en la nube:', e);
      setTransactions(prev => prev.filter(t => t.id !== tempId));
    }
  }, [user]);

  const updateTransaction = useCallback(async (id, data) => { 
    // Modificación instantánea en UI
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));

    try {
      await updateDoc(doc(db, 'transactions', id), data); 
    } catch (e) {
      console.warn('Error actualizando en la nube:', e);
    }
  }, []);

  const deleteTransaction = useCallback(async (id) => { 
    // Eliminación instantánea en UI
    setTransactions(prev => prev.filter(t => t.id !== id));

    try {
      await deleteDoc(doc(db, 'transactions', id)); 
    } catch (e) {
      console.warn('Error borrando en la nube:', e);
    }
  }, []);

  // Cuentas: respuesta inmediata
  const addAccount = useCallback(async (name) => { 
    if (!user?.email) return;
    const tempId = `temp_acc_${Date.now()}`;
    setAccounts(prev => [...prev, { id: tempId, name, userId: user.email }]);

    try {
      await addDoc(collection(db, 'accounts'), { name, userId: user.email }); 
    } catch (e) {
      setAccounts(prev => prev.filter(a => a.id !== tempId));
    }
  }, [user]);

  const deleteAccount = useCallback(async (id) => { 
    setAccounts(prev => prev.filter(a => a.id !== id));
    try { 
      await deleteDoc(doc(db, 'accounts', id)); 
    } catch (e) { 
      console.warn('Error borrando cuenta:', e);
    } 
  }, []);

  // Presupuestos: respuesta inmediata
  const addBudget = useCallback(async (category, monthlyLimit) => {
    if (!user?.email) return;
    const tempId = `temp_b_${Date.now()}`;
    const newB = { id: tempId, category: category.trim(), monthlyLimit: Number(monthlyLimit), userId: user.email };
    setBudgets(prev => [...prev, newB]);

    const categoryClean = category.trim().toLowerCase();
    if (globalAlertsRef.current[categoryClean]) delete globalAlertsRef.current[categoryClean];

    try {
      await addDoc(collection(db, 'budgets'), { category: category.trim(), monthlyLimit: Number(monthlyLimit), userId: user.email });
    } catch (e) {
      setBudgets(prev => prev.filter(b => b.id !== tempId));
    }
  }, [user]);

  const deleteBudget = useCallback(async (id) => { 
    const budgetToDelete = budgets.find(b => b.id === id);
    if (budgetToDelete?.category) delete globalAlertsRef.current[budgetToDelete.category.trim().toLowerCase()];
    setBudgets(prev => prev.filter(b => b.id !== id));

    try {
      await deleteDoc(doc(db, 'budgets', id)); 
    } catch (e) {
      console.warn('Error borrando presupuesto:', e);
    }
  }, [budgets]);

  // Context value completamente memorizado para evitar re-renders innecesarios
  const contextValue = useMemo(() => ({
    transactions, 
    accounts, 
    budgets, 
    customCategories,
    allCategories, 
    addTransaction, 
    updateTransaction, 
    deleteTransaction, 
    addAccount, 
    deleteAccount, 
    addBudget, 
    deleteBudget, 
    addCustomCategory, 
    deleteCustomCategory, 
    getMonthSummary, 
    getAccountBalances
  }), [
    transactions, 
    accounts, 
    budgets, 
    customCategories,
    allCategories, 
    addTransaction, 
    updateTransaction, 
    deleteTransaction, 
    addAccount, 
    deleteAccount, 
    addBudget, 
    deleteBudget, 
    addCustomCategory, 
    deleteCustomCategory, 
    getMonthSummary, 
    getAccountBalances
  ]);

  return (
    <FinanceContext.Provider value={contextValue}>
      {children}

      {/* ─── UI DE LA NOTIFICACIÓN FLOTANTE INTERACTIVA RESPONSIVA ─── */}
      {toast.visible && (
        <Animated.View style={[
          styles.toastContainer, 
          { transform: [{ translateY: animatedValue }] },
          toast.type === 'danger' ? styles.toastDanger : styles.toastWarning
        ]}>
          <TouchableOpacity onPress={handleToastPress} activeOpacity={0.85} style={styles.toastContent}>
            <Text style={styles.toastTitle}>{toast.title}</Text>
            <Text style={styles.toastMessage}>{toast.message}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </FinanceContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0, 
    left: normalize(16),
    right: normalize(16),
    width: SCREEN_WIDTH - normalize(32),
    borderRadius: normalize(12),
    padding: normalize(14),
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 999999, 
  },
  toastDanger: {
    backgroundColor: '#D32F2F', 
  },
  toastWarning: {
    backgroundColor: '#E65100', 
  },
  toastContent: {
    width: '100%',
  },
  toastTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: normalize(13),
    marginBottom: normalize(4),
  },
  toastMessage: {
    color: '#fff',
    fontSize: normalize(11),
    opacity: 0.95,
    lineHeight: normalize(15)
  }
});