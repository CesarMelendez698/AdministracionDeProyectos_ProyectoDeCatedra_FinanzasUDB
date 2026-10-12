import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
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

export const FinanceProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [customCategories, setCustomCategories] = useState([]); 

  const defaultCategories = ['Alimentación', 'Transporte', 'Estudios UDB', 'Servicios', 'Entretenimiento', 'Salud'];

  // 🚨 REF PERSISTENTE GLOBAL: Evita duplicar disparos en el ciclo de vida
  const globalAlertsRef = useRef({});

  // ─── ESTADOS Y ANIMACIÓN PARA LA NOTIFICACIÓN IN-APP ───
  const [toast, setToast] = useState({ visible: false, title: '', message: '', type: 'info' });
  const animatedValue = useRef(new Animated.Value(-normalize(150))).current; 
  const timerRef = useRef(null);

  // Función para mostrar la notificación animada
  const showGlobalNotification = (title, message, type = 'info') => {
    if (timerRef.current) clearTimeout(timerRef.current);

    setToast({ visible: true, title, message, type });

    // Animación de entrada (baja desde el tope) con rebote elástico controlado
    Animated.spring(animatedValue, {
      toValue: STATUSBAR_HEIGHT + normalize(10), // Posición final dinámica y segura
      useNativeDriver: true,
      tension: 20,
      friction: 6,
    }).start();

    // Temporizador estricto de 7 segundos para desvanecerse
    timerRef.current = setTimeout(() => {
      dismissNotification();
    }, 7000);
  };

  // Función para ocultar la notificación
  const dismissNotification = () => {
    Animated.timing(animatedValue, {
      toValue: -normalize(150), 
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      setToast(prev => ({ ...prev, visible: false }));
    });
  };

  // Redirección directa al presionar el Banner
  const handleToastPress = () => {
    dismissNotification(); 
    NavigationService.navigate('Presupuestos'); 
  };

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

    const { collection, onSnapshot, query, where } = require('firebase/firestore');
    const unsubscribes = [];

    // 1. Escucha de Transacciones
    const qTransactions = query(collection(db, 'transactions'), where('userId', '==', user.email));
    unsubscribes.push(onSnapshot(qTransactions, (snapshot) => {
      const txList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      txList.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(txList);
    }));

    // 2. Escucha de Cuentas
    const qAccounts = query(collection(db, 'accounts'), where('userId', '==', user.email));
    unsubscribes.push(onSnapshot(qAccounts, async (snapshot) => {
      const { addDoc } = require('firebase/firestore');
      const accList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      setBudgets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }));

    // 4. Escucha activa de Categorías Personalizadas
    const qCategories = query(collection(db, 'categories'), where('userId', '==', user.email));
    unsubscribes.push(onSnapshot(qCategories, (snapshot) => {
      const categoriesArr = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setCustomCategories(categoriesArr); 
    }));

    return () => {
      unsubscribes.forEach(unsub => unsub());
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user]);

  // --- 🔊 MONITOR GLOBAL DE PRESUPUESTOS ---
  useEffect(() => {
    if (!budgets || budgets.length === 0) return;

    const currentYearMonth = new Date().toISOString().slice(0, 7);

    budgets.forEach(b => {
      if (!b.category || !b.monthlyLimit) return;

      const categoryClean = b.category.trim().toLowerCase();
      const limitValue = Number(b.monthlyLimit);

      if (limitValue <= 0) return;

      const spent = transactions
        .filter(t => t && t.type === 'expense' && t.category && t.category.trim().toLowerCase() === categoryClean && t.date && t.date.startsWith(currentYearMonth))
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

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
  }, [transactions, budgets]);

  // --- MÉTODOS DE BASE DE DATOS ---
  const addCustomCategory = async (categoryName) => {
    if (!categoryName.trim()) return { success: false, message: 'Nombre vacío' };
    try {
      const { collection, addDoc } = require('firebase/firestore');
      const nameTrimmed = categoryName.trim();
      const customNames = customCategories.map(c => c.name.toLowerCase());
      const allNames = [...defaultCategories.map(c => c.toLowerCase()), ...customNames];
      if (allNames.includes(nameTrimmed.toLowerCase())) return { success: false, message: 'La categoría ya existe.' };
      await addDoc(collection(db, 'categories'), { name: nameTrimmed, userId: user.email });
      return { success: true };
    } catch (error) {
      return { success: false, message: 'Error al guardar.' };
    }
  };

  const deleteCustomCategory = async (categoryId) => {
    try { 
      const { doc, deleteDoc } = require('firebase/firestore');
      await deleteDoc(doc(db, 'categories', categoryId)); 
    } catch (error) { console.error(error); }
  };

  const getUnifiedCategories = () => [...defaultCategories, ...customCategories.map(c => c.name)];

  const getMonthSummary = (transactionsList) => {
    const safeList = Array.isArray(transactionsList) ? transactionsList : [];
    const currentMonth = new Date().toISOString().slice(0, 7);
    const filtered = safeList.filter(t => t.date && t.date.startsWith(currentMonth));
    const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return { income, expense, balance: income - expense };
  };

  const getAccountBalances = () => {
    return accounts.map(account => {
      const accountTx = transactions.filter(t => t.accountId === account.id);
      const income = accountTx.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const expense = accountTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
      return { ...account, balance: income - expense };
    });
  };

  const addTransaction = async (data) => { 
    const { collection, addDoc } = require('firebase/firestore');
    await addDoc(collection(db, 'transactions'), { ...data, userId: user.email }); 
  };
  const updateTransaction = async (id, data) => { 
    const { doc, updateDoc } = require('firebase/firestore');
    await updateDoc(doc(db, 'transactions', id), data); 
  };
  const deleteTransaction = async (id) => { 
    const { doc, deleteDoc } = require('firebase/firestore');
    await deleteDoc(doc(db, 'transactions', id)); 
  };
  const addAccount = async (name) => { 
    const { collection, addDoc } = require('firebase/firestore');
    await addDoc(collection(db, 'accounts'), { name, userId: user.email }); 
  };
  const deleteAccount = async (id) => { 
    const { doc, deleteDoc } = require('firebase/firestore');
    try { await deleteDoc(doc(db, 'accounts', id)); } catch (e) { throw e; } 
  };

  const addBudget = async (category, monthlyLimit) => {
    const { collection, addDoc } = require('firebase/firestore');
    const categoryClean = category.trim().toLowerCase();
    if (globalAlertsRef.current[categoryClean]) delete globalAlertsRef.current[categoryClean];
    await addDoc(collection(db, 'budgets'), { category: category.trim(), monthlyLimit: Number(monthlyLimit), userId: user.email });
  };

  const deleteBudget = async (id) => { 
    const { doc, deleteDoc } = require('firebase/firestore');
    const budgetToDelete = budgets.find(b => b.id === id);
    if (budgetToDelete?.category) delete globalAlertsRef.current[budgetToDelete.category.trim().toLowerCase()];
    await deleteDoc(doc(db, 'budgets', id)); 
  };

  return (
    <FinanceContext.Provider value={{
      transactions, accounts, budgets, customCategories,
      allCategories: getUnifiedCategories(), 
      addTransaction, updateTransaction, deleteTransaction, 
      addAccount, deleteAccount, addBudget, deleteBudget, 
      addCustomCategory, deleteCustomCategory, getMonthSummary, getAccountBalances
    }}>
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