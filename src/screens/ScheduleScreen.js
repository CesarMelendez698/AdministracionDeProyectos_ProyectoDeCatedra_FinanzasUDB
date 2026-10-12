import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  PixelRatio,
  Platform,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { syncClassNotifications } from '../services/notificationService';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { db } from '../config/firebase';
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 360;

function normalize(size) {
  const newSize = size * scale;
  if (Platform.OS === 'android') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

function formatTime12h(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = hours < 10 ? `0${hours}` : `${hours}`;
  const strMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${strHours}:${strMinutes} ${ampm}`;
}

function parseTimeStringToDate(timeStr) {
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
}

function timeStringToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = (match[3] || '').toUpperCase();

  if (ampm === 'PM' && hours < 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

const STORAGE_KEY = '@user_institutional_schedule';
const STORAGE_CAREER = '@user_institutional_career';

const DAYS_OF_WEEK = [
  { key: 'lunes', label: 'Lun', full: 'Lunes' },
  { key: 'martes', label: 'Mar', full: 'Martes' },
  { key: 'miercoles', label: 'Mié', full: 'Miércoles' },
  { key: 'jueves', label: 'Jue', full: 'Jueves' },
  { key: 'viernes', label: 'Vie', full: 'Viernes' },
  { key: 'sabado', label: 'Sáb', full: 'Sábado' },
];

const COLOR_PALETTE = [
  '#2563EB', // Azul UDB
  '#059669', // Verde Esmeralda
  '#7C3AED', // Violeta
  '#EA580C', // Naranja
  '#DC2626', // Rojo
  '#0891B2', // Cyan
  '#DB2777', // Rosa
];

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

const SEED_SCHEDULE = [
  {
    materia: 'Servidores en Plataformas Libres',
    codigo: 'SPL404 - 01T',
    aula: 'Campus Virtual',
    docente: 'Carlos Mauricio Castillo Guerrero',
    horaInicio: '06:00 PM',
    horaFin: '08:00 PM',
    dias: ['lunes', 'miercoles'],
    color: '#2563EB',
  },
  {
    materia: 'Seguridad de Redes',
    codigo: 'SDR404 - 01T',
    aula: 'Campus Virtual',
    docente: 'Carlos Eduardo Cortez Esperanza',
    horaInicio: '06:00 PM',
    horaFin: '08:00 PM',
    dias: ['martes', 'jueves'],
    color: '#059669',
  },
  {
    materia: 'Electrónica Aplicada al Internet de las Cosas',
    codigo: 'EAI441 - 01T',
    aula: 'Campus Virtual',
    docente: 'Rene Antonio Barjas Cañenguez',
    horaInicio: '08:00 PM',
    horaFin: '09:50 PM',
    dias: ['lunes', 'miercoles'],
    color: '#7C3AED',
  },
  {
    materia: 'Desarrollo de Software para Móviles',
    codigo: 'DSM441 - 01T',
    aula: 'Campus Virtual',
    docente: 'Elmer Antonio Menjivar',
    horaInicio: '06:00 PM',
    horaFin: '08:00 PM',
    dias: ['sabado'],
    color: '#EA580C',
  },
];

export default function ScheduleScreen() {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const { user } = useContext(AuthContext);

  const todayIndex = new Date().getDay();
  const initialDay = todayIndex >= 1 && todayIndex <= 6 ? DAYS_OF_WEEK[todayIndex - 1].key : 'lunes';

  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [scheduleList, setScheduleList] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [syncStatus, setSyncStatus] = useState('syncing');

  // Estado de Carrera Universitaria
  const [career, setCareer] = useState('');
  const [careerModalVisible, setCareerModalVisible] = useState(false);
  const [customCareerInput, setCustomCareerInput] = useState('');

  // Form State manual para crear / editar
  const [formMateria, setFormMateria] = useState('');
  const [formCodigo, setFormCodigo] = useState('');
  const [formAula, setFormAula] = useState('');
  const [formDocente, setFormDocente] = useState('');
  const [formHoraInicio, setFormHoraInicio] = useState('06:00 PM');
  const [formHoraFin, setFormHoraFin] = useState('08:00 PM');
  const [formDias, setFormDias] = useState([selectedDay]);
  const [formColor, setFormColor] = useState(COLOR_PALETTE[0]);

  // Portapapeles y Modal de Copia a otro día
  const [clipboardItem, setClipboardItem] = useState(null);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [itemToCopy, setItemToCopy] = useState(null);
  const [targetCopyDays, setTargetCopyDays] = useState([]);

  // Estado para alternar entre Vista Diaria y Lista de Materias (sin duplicados)
  const [activeScheduleTab, setActiveScheduleTab] = useState('calendar'); // 'calendar' | 'subjects'

  // Estado para el reloj interactivo (selector de hora)
  const [timePickerTarget, setTimePickerTarget] = useState(null); // 'start' | 'end' | null

  const onTimeChange = (event, selectedDate) => {
    const target = timePickerTarget;
    setTimePickerTarget(null);
    if (event.type === 'dismissed') {
      return;
    }
    if (selectedDate && target) {
      const formatted = formatTime12h(selectedDate);
      if (target === 'start') {
        setFormHoraInicio(formatted);
      } else if (target === 'end') {
        setFormHoraFin(formatted);
      }
    }
  };

  const userStorageKey = user?.email ? `${STORAGE_KEY}_${user.email}` : STORAGE_KEY;
  const userCareerKey = user?.email ? `${STORAGE_CAREER}_${user.email}` : STORAGE_CAREER;

  // 1. CARGA INICIAL DE CACHÉ LOCAL AISLADO POR USUARIO
  useEffect(() => {
    // Resetear de inmediato para que si cambia de usuario no muestre nada del anterior
    setCareer('');
    setScheduleList([]);

    const loadInitialData = async () => {
      try {
        const savedCareer = await AsyncStorage.getItem(userCareerKey);
        setCareer(savedCareer || '');

        const saved = await AsyncStorage.getItem(userStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setScheduleList(parsed);
            return;
          }
        }
        setScheduleList([]);
      } catch (e) {
        console.warn('Error leyendo caché local de horario:', e);
      }
    };
    loadInitialData();
  }, [userStorageKey, userCareerKey]);

  // 2. SINCRONIZACIÓN HÍBRIDA EN TIEMPO REAL CON FIREBASE FIRESTORE
  useEffect(() => {
    if (!user || !user.email) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('syncing');
    const qSchedule = query(collection(db, 'schedule'), where('userId', '==', user.email));

    const unsubscribe = onSnapshot(
      qSchedule,
      async (snapshot) => {
        const cloudItems = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        if (cloudItems.length === 0 && !snapshot.metadata.fromCache) {
          // Nueva cuenta o cuenta limpia: empieza vacía sin precargar datos de ejemplo de otro usuario
          setScheduleList([]);
          try {
            await AsyncStorage.setItem(userStorageKey, JSON.stringify([]));
          } catch (cacheErr) {
            console.warn('Error limpiando caché local:', cacheErr);
          }
          setSyncStatus('cloud');
        } else {
          setScheduleList(cloudItems);
          try {
            await AsyncStorage.setItem(userStorageKey, JSON.stringify(cloudItems));
          } catch (cacheErr) {
            console.warn('Error actualizando caché local:', cacheErr);
          }
          setSyncStatus('cloud');
        }
      },
      (error) => {
        console.warn('Firestore offline o con error, usando caché local:', error);
        setSyncStatus('offline');
      }
    );

    return () => unsubscribe();
  }, [user, userStorageKey]);

  const updateLocalCache = async (newList) => {
    setScheduleList(newList);
    try {
      await AsyncStorage.setItem(userStorageKey, JSON.stringify(newList));
      syncClassNotifications(newList);
    } catch (e) {
      console.error('Error guardando en caché local:', e);
    }
  };

  // Exportar / Compartir Horario Semanal Completo
  const handleExportSchedule = async () => {
    if (!scheduleList || scheduleList.length === 0) {
      Alert.alert('Horario Vacío', 'No tienes asignaturas registradas para compartir.');
      return;
    }

    let text = `📅 MI HORARIO INSTITUCIONAL UDB\n`;
    if (career) text += `🎓 Carrera: ${career}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    DAYS_OF_WEEK.forEach((d) => {
      const classesForDay = scheduleList
        .filter((item) => (item.dias || []).includes(d.key))
        .sort((a, b) => timeStringToMinutes(a.horaInicio) - timeStringToMinutes(b.horaInicio));

      if (classesForDay.length > 0) {
        text += `📌 ${d.full.toUpperCase()}:\n`;
        classesForDay.forEach((c) => {
          text += `  • ${c.materia}\n`;
          text += `    ⏰ ${c.horaInicio} - ${c.horaFin}\n`;
          if (c.aula) text += `    📍 Aula: ${c.aula}\n`;
          if (c.docente) text += `    👨‍🏫 Prof: ${c.docente}\n`;
          if (c.codigo) text += `    🏷️ Grupo: ${c.codigo}\n`;
          text += `\n`;
        });
      }
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━\nGenerado con FinanzasApp UDB 📱`;

    try {
      await Share.share({
        message: text,
        title: 'Horario Institucional UDB',
      });
    } catch (error) {
      console.warn('Error compartiendo horario:', error);
    }
  };

  // Guardar Carrera
  const handleSelectCareer = async (selected) => {
    setCareer(selected);
    setCareerModalVisible(false);
    try {
      await AsyncStorage.setItem(userCareerKey, selected);
    } catch (e) {
      console.warn('Error guardando carrera:', e);
    }
  };

  // Abrir modal de añadir manual
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormMateria('');
    setFormCodigo('');
    setFormAula('');
    setFormDocente('');
    setFormHoraInicio('06:00 PM');
    setFormHoraFin('08:00 PM');
    setFormDias([selectedDay]);
    setFormColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]);
    setModalVisible(true);
  };

  // Abrir modal de editar
  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setFormMateria(item.materia || '');
    setFormCodigo(item.codigo || '');
    setFormAula(item.aula || '');
    setFormDocente(item.docente || '');
    setFormHoraInicio(item.horaInicio || '06:00 PM');
    setFormHoraFin(item.horaFin || '08:00 PM');
    setFormDias(item.dias || [selectedDay]);
    setFormColor(item.color || COLOR_PALETTE[0]);
    setModalVisible(true);
  };

  // Guardar materia manual
  const handleSaveItem = async () => {
    if (!formMateria.trim()) {
      Alert.alert('Campo Requerido', 'Por favor ingresa el nombre de la materia.');
      return;
    }
    if (formDias.length === 0) {
      Alert.alert('Selecciona un Día', 'Debes seleccionar al menos un día para esta clase.');
      return;
    }

    const payload = {
      materia: formMateria.trim(),
      codigo: formCodigo.trim(),
      aula: formAula.trim(),
      docente: formDocente.trim(),
      horaInicio: formHoraInicio.trim(),
      horaFin: formHoraFin.trim(),
      dias: formDias,
      color: formColor,
      userId: user?.email || 'local_user',
    };

    setModalVisible(false);

    if (editingItem) {
      const updatedList = scheduleList.map((item) =>
        item.id === editingItem.id ? { ...item, ...payload } : item
      );
      updateLocalCache(updatedList);

      if (user && editingItem.id && !editingItem.id.startsWith('local-')) {
        try {
          await updateDoc(doc(db, 'schedule', editingItem.id), payload);
        } catch (e) {
          console.warn('Error actualizando en Firestore:', e);
        }
      }
    } else {
      const tempId = `class-${Date.now()}`;
      const newItem = { id: tempId, ...payload };
      updateLocalCache([...scheduleList, newItem]);

      if (user) {
        try {
          await addDoc(collection(db, 'schedule'), payload);
        } catch (e) {
          console.warn('Error creando en Firestore:', e);
        }
      }
    }
  };

  // Eliminar materia
  const handleDeleteItem = (item) => {
    Alert.alert(
      'Eliminar Asignatura',
      `¿Deseas remover "${item.materia}" de tu horario institucional?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const filtered = scheduleList.filter((s) => s.id !== item.id);
            updateLocalCache(filtered);

            if (user && item.id && !item.id.startsWith('local-')) {
              try {
                await deleteDoc(doc(db, 'schedule', item.id));
              } catch (e) {
                console.warn('Error eliminando en Firestore:', e);
              }
            }
          },
        },
      ]
    );
  };

  // ── MÉTODOS DE COPIA Y PEGADO DE BLOQUES DE MATERIA ──
  const handleOpenCopyModal = (item) => {
    setItemToCopy(item);
    // Sugerir días excluyendo los que ya tiene asignados
    const otherDays = DAYS_OF_WEEK.filter((d) => !(item.dias || []).includes(d.key));
    setTargetCopyDays(otherDays.length > 0 ? [otherDays[0].key] : []);
    setClipboardItem(item); // También queda disponible en portapapeles rápido
    setCopyModalVisible(true);
  };

  const handleToggleCopyDay = (dayKey) => {
    if (targetCopyDays.includes(dayKey)) {
      setTargetCopyDays(targetCopyDays.filter((d) => d !== dayKey));
    } else {
      setTargetCopyDays([...targetCopyDays, dayKey]);
    }
  };

  const handleExecuteCopy = async () => {
    if (!itemToCopy) return;
    if (targetCopyDays.length === 0) {
      Alert.alert('Selecciona un Día', 'Por favor selecciona al menos un día para pegar la copia de esta materia.');
      return;
    }

    const newItemsToCreate = targetCopyDays.map((targetDay, index) => ({
      id: `class-${Date.now()}-${index}`,
      materia: itemToCopy.materia,
      codigo: itemToCopy.codigo || '',
      aula: itemToCopy.aula || '',
      docente: itemToCopy.docente || '',
      horaInicio: itemToCopy.horaInicio || '06:00 PM',
      horaFin: itemToCopy.horaFin || '08:00 PM',
      dias: [targetDay],
      color: itemToCopy.color || COLOR_PALETTE[0],
      userId: user?.email || 'local_user',
    }));

    const updatedList = [...scheduleList, ...newItemsToCreate];
    updateLocalCache(updatedList);
    setCopyModalVisible(false);

    if (user && user.email) {
      try {
        for (const newItem of newItemsToCreate) {
          const { id, ...dataToUpload } = newItem;
          await addDoc(collection(db, 'schedule'), dataToUpload);
        }
      } catch (err) {
        console.warn('Error sincronizando copias en Firestore:', err);
      }
    }

    const dayNames = targetCopyDays
      .map((k) => DAYS_OF_WEEK.find((d) => d.key === k)?.full)
      .join(', ');

    Alert.alert(
      '¡Asignatura Copiada!',
      `Se duplicó "${itemToCopy.materia}" en: ${dayNames}.\n\nCada bloque es independiente: puedes editar su horario, aula o eliminarlo en cualquier momento.`
    );
  };

  const handlePasteClipboardToCurrentDay = async () => {
    if (!clipboardItem) return;

    const newItem = {
      id: `class-${Date.now()}`,
      materia: clipboardItem.materia,
      codigo: clipboardItem.codigo || '',
      aula: clipboardItem.aula || '',
      docente: clipboardItem.docente || '',
      horaInicio: clipboardItem.horaInicio || '06:00 PM',
      horaFin: clipboardItem.horaFin || '08:00 PM',
      dias: [selectedDay],
      color: clipboardItem.color || COLOR_PALETTE[0],
      userId: user?.email || 'local_user',
    };

    const updatedList = [...scheduleList, newItem];
    updateLocalCache(updatedList);

    if (user && user.email) {
      try {
        const { id, ...dataToUpload } = newItem;
        await addDoc(collection(db, 'schedule'), dataToUpload);
      } catch (err) {
        console.warn('Error sincronizando bloque pegado en Firestore:', err);
      }
    }

    Alert.alert(
      '¡Bloque Pegado con Éxito!',
      `"${clipboardItem.materia}" ha sido añadida a ${selectedDayObject.full}.\n\nPuedes editarla o eliminarla cuando desees.`
    );
  };

  const toggleDaySelection = (dayKey) => {
    if (formDias.includes(dayKey)) {
      if (formDias.length === 1) return;
      setFormDias(formDias.filter((d) => d !== dayKey));
    } else {
      setFormDias([...formDias, dayKey]);
    }
  };

  // Agrupación inteligente de materias únicas (evita contar doble clases de diferente horario/aula)
  const uniqueSubjects = useMemo(() => {
    const map = new Map();
    (scheduleList || []).forEach((item) => {
      const nameKey = (item.materia || '').trim().toLowerCase();
      if (!nameKey) return;

      if (!map.has(nameKey)) {
        map.set(nameKey, {
          key: nameKey,
          materia: (item.materia || '').trim(),
          codigo: item.codigo || '',
          docente: item.docente || '',
          color: item.color || COLOR_PALETTE[0],
          rawItems: [],
          sessions: [],
        });
      }

      const entry = map.get(nameKey);
      entry.rawItems.push(item);
      if (!entry.codigo && item.codigo) entry.codigo = item.codigo;
      if (!entry.docente && item.docente) entry.docente = item.docente;

      (item.dias || []).forEach((dayKey) => {
        const dayMeta = DAYS_OF_WEEK.find((d) => d.key === dayKey);
        entry.sessions.push({
          itemId: item.id,
          dayKey,
          dayFull: dayMeta ? dayMeta.full : dayKey,
          dayLabel: dayMeta ? dayMeta.label : dayKey,
          horaInicio: item.horaInicio || '06:00 PM',
          horaFin: item.horaFin || '08:00 PM',
          aula: item.aula || 'Sin aula',
          rawItem: item,
        });
      });
    });

    const list = Array.from(map.values());
    list.forEach((sub) => {
      sub.sessions.sort((a, b) => {
        const dayIdxA = DAYS_OF_WEEK.findIndex((d) => d.key === a.dayKey);
        const dayIdxB = DAYS_OF_WEEK.findIndex((d) => d.key === b.dayKey);
        if (dayIdxA !== dayIdxB) return dayIdxA - dayIdxB;
        return timeStringToMinutes(a.horaInicio) - timeStringToMinutes(b.horaInicio);
      });
    });

    list.sort((a, b) => a.materia.localeCompare(b.materia));
    return list;
  }, [scheduleList]);

  const totalWeeklySessions = useMemo(() => {
    return uniqueSubjects.reduce((acc, curr) => acc + curr.sessions.length, 0);
  }, [uniqueSubjects]);

  // Manejador para agregar una nueva sesión (diferente día/hora/aula) a una materia existente
  const handleOpenAddSessionForMateria = (subjectGroup) => {
    setEditingItem(null);
    setFormMateria(subjectGroup.materia);
    setFormCodigo(subjectGroup.codigo || '');
    setFormDocente(subjectGroup.docente || '');
    setFormColor(subjectGroup.color || COLOR_PALETTE[0]);
    setFormAula('');
    setFormHoraInicio('06:00 PM');
    setFormHoraFin('08:00 PM');
    const assignedDays = subjectGroup.sessions.map((s) => s.dayKey);
    const availableDay = DAYS_OF_WEEK.find((d) => !assignedDays.includes(d.key));
    setFormDias([availableDay ? availableDay.key : selectedDay]);
    setModalVisible(true);
  };

  // Eliminar una sesión individual o bloque de una materia
  const handleDeleteSession = (session) => {
    Alert.alert(
      'Eliminar Horario',
      `¿Deseas eliminar la clase de ${session.dayFull} (${session.horaInicio} - ${session.horaFin}) de "${session.rawItem.materia}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const raw = session.rawItem;
            if (raw.dias && raw.dias.length > 1) {
              const updatedDias = raw.dias.filter((d) => d !== session.dayKey);
              const updatedList = scheduleList.map((s) =>
                s.id === raw.id ? { ...s, dias: updatedDias } : s
              );
              updateLocalCache(updatedList);
              if (user && raw.id && !raw.id.startsWith('local-')) {
                try {
                  await updateDoc(doc(db, 'schedule', raw.id), { dias: updatedDias });
                } catch (e) {
                  console.warn('Error actualizando días en Firestore:', e);
                }
              }
            } else {
              const filtered = scheduleList.filter((s) => s.id !== raw.id);
              updateLocalCache(filtered);
              if (user && raw.id && !raw.id.startsWith('local-')) {
                try {
                  await deleteDoc(doc(db, 'schedule', raw.id));
                } catch (e) {
                  console.warn('Error eliminando en Firestore:', e);
                }
              }
            }
          },
        },
      ]
    );
  };

  // Eliminar toda la materia con todas sus sesiones
  const handleDeleteEntireSubject = (subjectGroup) => {
    Alert.alert(
      'Eliminar Materia Completa',
      `¿Deseas eliminar "${subjectGroup.materia}" con todas sus ${subjectGroup.sessions.length} clases semanales?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar Todo',
          style: 'destructive',
          onPress: async () => {
            const itemIdsToDelete = new Set(subjectGroup.rawItems.map((r) => r.id));
            const filtered = scheduleList.filter((s) => !itemIdsToDelete.has(s.id));
            updateLocalCache(filtered);

            if (user) {
              for (const raw of subjectGroup.rawItems) {
                if (raw.id && !raw.id.startsWith('local-')) {
                  try {
                    await deleteDoc(doc(db, 'schedule', raw.id));
                  } catch (e) {
                    console.warn('Error eliminando lote en Firestore:', e);
                  }
                }
              }
            }
          },
        },
      ]
    );
  };

  const dayClasses = useMemo(() => {
    return scheduleList
      .filter((item) => (item.dias || []).includes(selectedDay))
      .sort((a, b) => {
        const timeA = timeStringToMinutes(a.horaInicio);
        const timeB = timeStringToMinutes(b.horaInicio);
        if (timeA !== timeB) return timeA - timeB;
        return timeStringToMinutes(a.horaFin) - timeStringToMinutes(b.horaFin);
      });
  }, [scheduleList, selectedDay]);

  const selectedDayObject = DAYS_OF_WEEK.find((d) => d.key === selectedDay) || DAYS_OF_WEEK[0];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 1. Barra de Sincronización Híbrida (Firebase Cloud + Local Offline) */}
      <View
        style={[
          styles.syncBar,
          {
            backgroundColor:
              syncStatus === 'cloud'
                ? isDarkMode ? '#064E3B' : '#ECFDF5'
                : syncStatus === 'offline'
                  ? isDarkMode ? '#451A03' : '#FEF3C7'
                  : isDarkMode ? '#1E293B' : '#F1F5F9',
          },
        ]}
      >
        <Ionicons
          name={
            syncStatus === 'cloud'
              ? 'cloud-done-outline'
              : syncStatus === 'offline'
                ? 'cloud-offline-outline'
                : 'sync-outline'
          }
          size={normalize(13)}
          color={
            syncStatus === 'cloud'
              ? '#10B981'
              : syncStatus === 'offline'
                ? '#D97706'
                : '#2196F3'
          }
        />
        <Text
          style={[
            styles.syncText,
            {
              color:
                syncStatus === 'cloud'
                  ? isDarkMode ? '#34D399' : '#047857'
                  : syncStatus === 'offline'
                    ? isDarkMode ? '#FBBF24' : '#92400E'
                    : theme.textSecondary,
            },
          ]}
        >
          {syncStatus === 'cloud'
            ? 'Sincronizado con Firebase Firestore'
            : syncStatus === 'offline'
              ? 'Modo sin conexión - Guardado local'
              : 'Sincronizando con Firebase...'}
        </Text>
      </View>

      {/* 2. Tarjeta de Carrera Institucional del Estudiante */}
      <View style={[styles.careerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.careerInfo}>
          <View style={[styles.careerIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="school" size={normalize(18)} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.careerLabel, { color: theme.textSecondary }]}>Carrera Universitaria</Text>
            <Text
              style={[
                styles.careerName,
                { color: career ? theme.textPrimary : '#2563EB' },
              ]}
              numberOfLines={1}
            >
              {career || 'Toca para seleccionar tu carrera'}
            </Text>
            <Text style={[styles.careerStatsSub, { color: theme.textSecondary }]}>
              {uniqueSubjects.length} {uniqueSubjects.length === 1 ? 'materia inscrita' : 'materias inscritas'} • {totalWeeklySessions} {totalWeeklySessions === 1 ? 'clase semanal' : 'clases semanales'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: normalize(6) }}>
          <TouchableOpacity
            style={[styles.careerEditBtn, { borderColor: theme.border }]}
            onPress={handleExportSchedule}
          >
            <Ionicons name="share-social-outline" size={normalize(15)} color="#059669" />
            <Text style={[styles.careerEditBtnText, { color: '#059669' }]}>Compartir</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.careerEditBtn, { borderColor: theme.border }]}
            onPress={() => setCareerModalVisible(true)}
          >
            <Ionicons name="create-outline" size={normalize(15)} color="#2563EB" />
            <Text style={styles.careerEditBtnText}>{career ? 'Cambiar' : 'Elegir'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pestañas de Vista: Calendario Semanal vs Mis Materias */}
      <View style={[styles.tabSegmentContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
        <TouchableOpacity
          style={[
            styles.tabSegmentBtn,
            activeScheduleTab === 'calendar' && [
              styles.tabSegmentBtnActive,
              { backgroundColor: theme.card },
            ],
          ]}
          onPress={() => setActiveScheduleTab('calendar')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="calendar"
            size={normalize(14)}
            color={activeScheduleTab === 'calendar' ? '#2563EB' : theme.textSecondary}
          />
          <Text
            style={[
              styles.tabSegmentText,
              {
                color: activeScheduleTab === 'calendar' ? '#2563EB' : theme.textSecondary,
                fontWeight: activeScheduleTab === 'calendar' ? '700' : '600',
              },
            ]}
          >
            Horario Semanal
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabSegmentBtn,
            activeScheduleTab === 'subjects' && [
              styles.tabSegmentBtnActive,
              { backgroundColor: theme.card },
            ],
          ]}
          onPress={() => setActiveScheduleTab('subjects')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="book"
            size={normalize(14)}
            color={activeScheduleTab === 'subjects' ? '#2563EB' : theme.textSecondary}
          />
          <Text
            style={[
              styles.tabSegmentText,
              {
                color: activeScheduleTab === 'subjects' ? '#2563EB' : theme.textSecondary,
                fontWeight: activeScheduleTab === 'subjects' ? '700' : '600',
              },
            ]}
          >
            Mis Materias ({uniqueSubjects.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeScheduleTab === 'calendar' ? (
        <>
          {/* 3. Selector de Días de la Semana */}
          <View style={[styles.daySelectorHeader, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.daysRow}>
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDay === day.key;
                const count = scheduleList.filter((s) => (s.dias || []).includes(day.key)).length;

                return (
                  <TouchableOpacity
                    key={day.key}
                    activeOpacity={0.7}
                    onPress={() => setSelectedDay(day.key)}
                    style={[
                      styles.dayButton,
                      isSelected && styles.dayButtonSelected,
                      isSelected && { backgroundColor: '#2196F3' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayButtonLabel,
                        { color: isSelected ? '#FFFFFF' : theme.textSecondary },
                      ]}
                    >
                      {day.label}
                    </Text>
                    {count > 0 && (
                      <View
                        style={[
                          styles.dayDot,
                          { backgroundColor: isSelected ? '#FFFFFF' : '#2196F3' },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 4. Barra de Acciones: Día Seleccionado y Agregar Manual / Pegar */}
          <View style={styles.daySummaryBar}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dayTitle, { color: theme.textPrimary }]}>
                {selectedDayObject.full}
              </Text>
              <Text style={[styles.classesCountText, { color: theme.textSecondary }]}>
                {dayClasses.length} {dayClasses.length === 1 ? 'asignatura programada' : 'asignaturas programadas'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: normalize(6) }}>
              {clipboardItem && (
                <TouchableOpacity
                  style={styles.pasteHeaderButton}
                  onPress={handlePasteClipboardToCurrentDay}
                >
                  <Ionicons name="clipboard" size={normalize(15)} color="#FFFFFF" />
                  <Text style={styles.pasteHeaderButtonText}>Pegar</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.addClassButton}
                onPress={handleOpenAddModal}
              >
                <Ionicons name="add" size={normalize(18)} color="#FFFFFF" />
                <Text style={styles.addClassButtonText}>Añadir Materia</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Banner de Portapapeles si hay una materia copiada */}
          {clipboardItem && (
            <View
              style={[
                styles.clipboardBanner,
                {
                  backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
                  borderColor: isDarkMode ? '#3B82F6' : '#BFDBFE',
                },
              ]}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: normalize(8) }}>
                <View style={[styles.clipboardDot, { backgroundColor: clipboardItem.color || '#2196F3' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.clipboardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                    Copiado: {clipboardItem.materia}
                  </Text>
                  <Text style={[styles.clipboardSubtitle, { color: theme.textSecondary }]}>
                    {clipboardItem.horaInicio} - {clipboardItem.horaFin} • {clipboardItem.aula || 'Sin aula'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.clipboardActionPaste}
                onPress={handlePasteClipboardToCurrentDay}
              >
                <Ionicons name="duplicate-outline" size={normalize(13)} color="#FFFFFF" />
                <Text style={styles.clipboardActionPasteText}>Pegar en {selectedDayObject.label}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clipboardCloseBtn}
                onPress={() => setClipboardItem(null)}
              >
                <Ionicons name="close" size={normalize(16)} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* 5. Lista de Asignaturas del Día */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {dayClasses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' }]}>
                  <Ionicons name="calendar-outline" size={normalize(38)} color="#2196F3" />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  No hay clases para el {selectedDayObject.full}
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  Presiona el botón a continuación para registrar tus clases en este día.
                </Text>

                <TouchableOpacity
                  style={[styles.addClassButton, { marginTop: normalize(12), paddingHorizontal: normalize(16), paddingVertical: normalize(10) }]}
                  onPress={handleOpenAddModal}
                >
                  <Ionicons name="add-circle-outline" size={normalize(18)} color="#FFFFFF" />
                  <Text style={styles.addClassButtonText}>Añadir Materia</Text>
                </TouchableOpacity>
              </View>
            ) : (
              dayClasses.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.classCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={[styles.cardColorStrip, { backgroundColor: item.color || '#2196F3' }]} />

                  <View style={styles.cardMain}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.timeBadge}>
                        <Ionicons name="time-outline" size={normalize(13)} color="#2563EB" />
                        <Text style={styles.timeText}>
                          {item.horaInicio} - {item.horaFin}
                        </Text>
                      </View>

                      {item.codigo ? (
                        <View style={[styles.codeBadge, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
                          <Text style={[styles.codeText, { color: theme.textSecondary }]}>
                            {item.codigo}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={[styles.subjectName, { color: theme.textPrimary }]}>
                      {item.materia}
                    </Text>

                    <View style={styles.detailsContainer}>
                      {item.aula ? (
                        <View style={styles.detailRow}>
                          <Ionicons name="location-outline" size={normalize(14)} color={theme.textSecondary} />
                          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                            {item.aula}
                          </Text>
                        </View>
                      ) : null}

                      {item.docente ? (
                        <View style={styles.detailRow}>
                          <Ionicons name="person-outline" size={normalize(14)} color={theme.textSecondary} />
                          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                            {item.docente}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: theme.border }]}
                        onPress={() => handleOpenCopyModal(item)}
                      >
                        <Ionicons name="copy-outline" size={normalize(14)} color="#2563EB" />
                        <Text style={[styles.actionBtnText, { color: '#2563EB' }]}>Copiar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: theme.border }]}
                        onPress={() => handleOpenEditModal(item)}
                      >
                        <Ionicons name="pencil-outline" size={normalize(14)} color={theme.textPrimary} />
                        <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Editar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: theme.border }]}
                        onPress={() => handleDeleteItem(item)}
                      >
                        <Ionicons name="trash-outline" size={normalize(14)} color="#EF4444" />
                        <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </>
      ) : (
        /* VISTA: LISTA DE MATERIAS ÚNICAS (Agrupa todas sus sesiones/horarios/aulas) */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.subjectListHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dayTitle, { color: theme.textPrimary }]}>
                Mis Materias Inscritas
              </Text>
              <Text style={[styles.classesCountText, { color: theme.textSecondary }]}>
                {uniqueSubjects.length} {uniqueSubjects.length === 1 ? 'materia registrada' : 'materias registradas'} (sin contar sesiones duplicadas)
              </Text>
            </View>

            <TouchableOpacity
              style={styles.addClassButton}
              onPress={handleOpenAddModal}
            >
              <Ionicons name="add" size={normalize(18)} color="#FFFFFF" />
              <Text style={styles.addClassButtonText}>Nueva Materia</Text>
            </TouchableOpacity>
          </View>

          {uniqueSubjects.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' }]}>
                <Ionicons name="book-outline" size={normalize(38)} color="#2196F3" />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                No tienes materias inscritas
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Registra tus materias con sus respectivos días, aulas y horarios.
              </Text>

              <TouchableOpacity
                style={[styles.addClassButton, { marginTop: normalize(12), paddingHorizontal: normalize(16), paddingVertical: normalize(10) }]}
                onPress={handleOpenAddModal}
              >
                <Ionicons name="add-circle-outline" size={normalize(18)} color="#FFFFFF" />
                <Text style={styles.addClassButtonText}>Añadir Materia</Text>
              </TouchableOpacity>
            </View>
          ) : (
            uniqueSubjects.map((sub) => (
              <View
                key={sub.key}
                style={[
                  styles.subjectGroupCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={[styles.cardColorStrip, { backgroundColor: sub.color || '#2563EB' }]} />

                <View style={styles.subjectGroupMain}>
                  <View style={styles.subjectGroupHeader}>
                    <View style={{ flex: 1, marginRight: normalize(8) }}>
                      <Text style={[styles.subjectName, { color: theme.textPrimary, marginBottom: normalize(2) }]}>
                        {sub.materia}
                      </Text>
                      {sub.codigo ? (
                        <Text style={[styles.codeText, { color: theme.textSecondary }]}>
                          {sub.codigo}
                        </Text>
                      ) : null}
                    </View>

                    <View style={[styles.sessionCountBadge, { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' }]}>
                      <Ionicons name="time" size={normalize(12)} color="#2563EB" />
                      <Text style={styles.sessionCountBadgeText}>
                        {sub.sessions.length} {sub.sessions.length === 1 ? 'clase/sem' : 'clases/sem'}
                      </Text>
                    </View>
                  </View>

                  {sub.docente ? (
                    <View style={[styles.detailRow, { marginTop: normalize(6), marginBottom: normalize(8) }]}>
                      <Ionicons name="person-outline" size={normalize(13)} color={theme.textSecondary} />
                      <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                        {sub.docente}
                      </Text>
                    </View>
                  ) : null}

                  {/* Lista de Sesiones / Horarios / Aulas de esta misma materia */}
                  <View style={styles.sessionsSubList}>
                    <Text style={[styles.sessionsSectionTitle, { color: theme.textSecondary }]}>
                      Horarios y Aulas de la Semana:
                    </Text>

                    {sub.sessions.map((session, sIdx) => (
                      <View
                        key={`${session.itemId}-${session.dayKey}-${sIdx}`}
                        style={[
                          styles.sessionRowItem,
                          {
                            backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <View style={styles.sessionDayChip}>
                          <Text style={styles.sessionDayChipText}>{session.dayLabel}</Text>
                        </View>

                        <View style={{ flex: 1, paddingHorizontal: normalize(6) }}>
                          <Text style={[styles.sessionTimeText, { color: theme.textPrimary }]}>
                            {session.dayFull}: {session.horaInicio} - {session.horaFin}
                          </Text>
                          <Text style={[styles.sessionAulaText, { color: theme.textSecondary }]} numberOfLines={1}>
                            <Ionicons name="location-outline" size={normalize(11)} color={theme.textSecondary} /> {session.aula}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.sessionDeleteBtn}
                          onPress={() => handleDeleteSession(session)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={normalize(15)} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  {/* Acciones de la Materia */}
                  <View style={styles.subjectGroupActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: '#2563EB', backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' }]}
                      onPress={() => handleOpenAddSessionForMateria(sub)}
                    >
                      <Ionicons name="add-circle-outline" size={normalize(14)} color="#2563EB" />
                      <Text style={[styles.actionBtnText, { color: '#2563EB', fontWeight: '700' }]}>
                        Añadir otro horario / aula
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: theme.border }]}
                      onPress={() => handleDeleteEntireSubject(sub)}
                    >
                      <Ionicons name="trash-outline" size={normalize(14)} color="#EF4444" />
                      <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Borrar Materia</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

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

              <Text style={[styles.inputLabel, { color: theme.textPrimary, marginTop: normalize(12) }]}>
                ¿Otra carrera o especialidad?
              </Text>
              <View style={{ flexDirection: 'row', gap: normalize(8), marginTop: normalize(4) }}>
                <TextInput
                  style={[
                    styles.textInput,
                    { flex: 1, backgroundColor: theme.background, borderColor: theme.border, color: theme.textPrimary },
                  ]}
                  placeholder="Escribe tu carrera..."
                  placeholderTextColor={theme.textSecondary}
                  value={customCareerInput}
                  onChangeText={setCustomCareerInput}
                />
                <TouchableOpacity
                  style={[styles.addClassButton, { paddingHorizontal: normalize(14) }]}
                  onPress={() => {
                    if (customCareerInput.trim()) {
                      handleSelectCareer(customCareerInput.trim());
                    }
                  }}
                >
                  <Text style={styles.addClassButtonText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: CREAR / EDITAR ASIGNATURA MANUAL ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: theme.textPrimary }]}>
                {editingItem ? 'Editar Asignatura' : 'Nueva Asignatura'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={normalize(22)} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {!editingItem && uniqueSubjects.length > 0 && (
                <View style={styles.modalQuickSubjectsWrap}>
                  <Text style={[styles.modalQuickSubjectsLabel, { color: theme.textSecondary }]}>
                    ¿Es para una de tus materias registradas? Toca para autocompletar:
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalQuickSubjectsRow}>
                    {uniqueSubjects.map((sub) => {
                      const isSelected = formMateria.trim().toLowerCase() === sub.key;
                      return (
                        <TouchableOpacity
                          key={sub.key}
                          style={[
                            styles.quickSubjectChip,
                            {
                              backgroundColor: isSelected
                                ? (sub.color || '#2563EB')
                                : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                              borderColor: sub.color || '#2563EB',
                            },
                          ]}
                          onPress={() => {
                            setFormMateria(sub.materia);
                            if (sub.codigo) setFormCodigo(sub.codigo);
                            if (sub.docente) setFormDocente(sub.docente);
                            if (sub.color) setFormColor(sub.color);
                          }}
                        >
                          <Text
                            style={[
                              styles.quickSubjectChipText,
                              { color: isSelected ? '#FFFFFF' : theme.textPrimary },
                            ]}
                            numberOfLines={1}
                          >
                            {sub.materia}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Materia *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Ej. Servidores en Plataformas Libres"
                placeholderTextColor={theme.textSecondary}
                value={formMateria}
                onChangeText={setFormMateria}
              />

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Código / Grupo (Opcional)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Ej. SPL404 - 01T"
                placeholderTextColor={theme.textSecondary}
                value={formCodigo}
                onChangeText={setFormCodigo}
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: normalize(8) }}>
                  <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Hora Inicio</Text>
                  <TouchableOpacity
                    style={[
                      styles.timePickerButton,
                      {
                        backgroundColor: theme.background,
                        borderColor: timePickerTarget === 'start' ? '#2563EB' : theme.border,
                      },
                    ]}
                    onPress={() => setTimePickerTarget('start')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={normalize(18)} color="#2563EB" />
                    <Text style={[styles.timePickerValue, { color: theme.textPrimary }]}>
                      {formHoraInicio || '06:00 PM'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Hora Fin</Text>
                  <TouchableOpacity
                    style={[
                      styles.timePickerButton,
                      {
                        backgroundColor: theme.background,
                        borderColor: timePickerTarget === 'end' ? '#2563EB' : theme.border,
                      },
                    ]}
                    onPress={() => setTimePickerTarget('end')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={normalize(18)} color="#2563EB" />
                    <Text style={[styles.timePickerValue, { color: theme.textPrimary }]}>
                      {formHoraFin || '08:00 PM'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {timePickerTarget && (
                <DateTimePicker
                  value={parseTimeStringToDate(
                    timePickerTarget === 'start' ? formHoraInicio : formHoraFin
                  )}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === 'android' ? 'clock' : 'spinner'}
                  onChange={onTimeChange}
                />
              )}

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Aula / Ubicación</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Ej. Campus Virtual, Edificio 4 Lab 2"
                placeholderTextColor={theme.textSecondary}
                value={formAula}
                onChangeText={setFormAula}
              />

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Catedrático / Docente</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Ej. Carlos Mauricio Castillo Guerrero"
                placeholderTextColor={theme.textSecondary}
                value={formDocente}
                onChangeText={setFormDocente}
              />

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Días de Clase</Text>
              <View style={styles.modalDaysRow}>
                {DAYS_OF_WEEK.map((day) => {
                  const active = formDias.includes(day.key);
                  return (
                    <TouchableOpacity
                      key={day.key}
                      onPress={() => toggleDaySelection(day.key)}
                      style={[
                        styles.modalDayChip,
                        {
                          backgroundColor: active
                            ? '#2196F3'
                            : isDarkMode
                              ? '#1E293B'
                              : '#F1F5F9',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalDayChipText,
                          { color: active ? '#FFFFFF' : theme.textPrimary },
                        ]}
                      >
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Color Identificador</Text>
              <View style={styles.colorPaletteRow}>
                {COLOR_PALETTE.map((color) => {
                  const isSelected = formColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setFormColor(color)}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        isSelected && styles.colorCircleSelected,
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={normalize(14)} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSaveItem}
              >
                <Text style={styles.submitButtonText}>
                  {editingItem ? 'Guardar Cambios' : 'Inscribir Asignatura'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: COPIAR ASIGNATURA A OTRO DÍA ── */}
      <Modal
        visible={copyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCopyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: normalize(8) }}>
                <View style={[styles.copyIconBadge, { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' }]}>
                  <Ionicons name="copy-outline" size={normalize(18)} color="#2563EB" />
                </View>
                <Text style={[styles.modalTitleText, { color: theme.textPrimary }]}>
                  Copiar Asignatura
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCopyModalVisible(false)}>
                <Ionicons name="close" size={normalize(22)} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {itemToCopy && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Tarjeta resumen de la materia a copiar */}
                <View style={[styles.previewCopyCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <View style={[styles.previewColorStrip, { backgroundColor: itemToCopy.color || '#2196F3' }]} />
                  <View style={{ flex: 1, padding: normalize(10) }}>
                    <Text style={[styles.previewMateriaTitle, { color: theme.textPrimary }]}>
                      {itemToCopy.materia}
                    </Text>
                    <Text style={[styles.previewMateriaSub, { color: theme.textSecondary }]}>
                      {itemToCopy.horaInicio} - {itemToCopy.horaFin} • {itemToCopy.aula || 'Sin aula'}
                    </Text>
                    {itemToCopy.docente ? (
                      <Text style={[styles.previewMateriaDocente, { color: theme.textSecondary }]}>
                        Docente: {itemToCopy.docente}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: theme.textPrimary, marginTop: normalize(14) }]}>
                  Selecciona a qué día(s) deseas copiar esta materia:
                </Text>
                <View style={styles.modalDaysRow}>
                  {DAYS_OF_WEEK.map((day) => {
                    const active = targetCopyDays.includes(day.key);
                    return (
                      <TouchableOpacity
                        key={day.key}
                        onPress={() => handleToggleCopyDay(day.key)}
                        style={[
                          styles.modalDayChip,
                          {
                            backgroundColor: active
                              ? '#2563EB'
                              : isDarkMode
                                ? '#1E293B'
                                : '#F1F5F9',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.modalDayChipText,
                            { color: active ? '#FFFFFF' : theme.textPrimary },
                          ]}
                        >
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={[styles.copyTipBox, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC' }]}>
                  <Ionicons name="information-circle-outline" size={normalize(16)} color="#2563EB" />
                  <Text style={[styles.copyTipText, { color: theme.textSecondary }]}>
                    Se creará un bloque independiente. Podrás editar el aula, docente, hora o eliminarlo sin afectar la clase original.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: '#2563EB' }]}
                  onPress={handleExecuteCopy}
                >
                  <Text style={styles.submitButtonText}>
                    {targetCopyDays.length === 0
                      ? 'Selecciona al menos un día'
                      : targetCopyDays.length === 1
                        ? `Copiar a ${DAYS_OF_WEEK.find((d) => d.key === targetCopyDays[0])?.full}`
                        : `Copiar a ${targetCopyDays.length} días seleccionados`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.border }]}
                  onPress={() => {
                    setClipboardItem(itemToCopy);
                    setCopyModalVisible(false);
                    Alert.alert(
                      'Copiado al Portapapeles',
                      `Se copió "${itemToCopy.materia}". Puedes cambiar al día que quieras en las pestañas y presionar "Pegar" en la barra superior.`
                    );
                  }}
                >
                  <Ionicons name="clipboard-outline" size={normalize(16)} color={theme.textPrimary} />
                  <Text style={[styles.cancelBtnText, { color: theme.textPrimary }]}>
                    Guardar en portapapeles y pegar luego
                  </Text>
                </TouchableOpacity>
              </ScrollView>
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
  },
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: normalize(6),
    paddingHorizontal: normalize(14),
    gap: normalize(6),
  },
  syncText: {
    fontSize: normalize(11),
    fontWeight: '600',
  },
  careerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: normalize(14),
    marginTop: normalize(8),
    marginBottom: normalize(4),
    padding: normalize(10),
    borderRadius: normalize(12),
    borderWidth: 1,
  },
  careerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: normalize(8),
  },
  careerIconWrap: {
    width: normalize(34),
    height: normalize(34),
    borderRadius: normalize(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: normalize(10),
  },
  careerLabel: {
    fontSize: normalize(10),
    fontWeight: '600',
  },
  careerName: {
    fontSize: normalize(13),
    fontWeight: '700',
  },
  careerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(4),
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(5),
    borderRadius: normalize(8),
    borderWidth: 1,
  },
  careerEditBtnText: {
    color: '#2563EB',
    fontSize: normalize(11),
    fontWeight: '700',
  },
  daySelectorHeader: {
    borderBottomWidth: 1,
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(12),
    marginTop: normalize(6),
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(8),
    paddingHorizontal: normalize(10),
    borderRadius: normalize(12),
    minWidth: normalize(44),
  },
  dayButtonSelected: {
    elevation: 3,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  dayButtonLabel: {
    fontSize: normalize(12),
    fontWeight: '700',
  },
  dayDot: {
    width: normalize(4),
    height: normalize(4),
    borderRadius: normalize(2),
    marginTop: normalize(3),
  },
  daySummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: normalize(16),
    paddingTop: normalize(14),
    paddingBottom: normalize(8),
    gap: normalize(8),
  },
  dayTitle: {
    fontSize: normalize(18),
    fontWeight: '800',
  },
  classesCountText: {
    fontSize: normalize(11),
    marginTop: normalize(2),
  },
  addClassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(8),
    borderRadius: normalize(10),
    gap: normalize(4),
  },
  addClassButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: normalize(12),
  },
  scrollContent: {
    paddingHorizontal: normalize(14),
    paddingBottom: normalize(32),
  },
  classCard: {
    flexDirection: 'row',
    borderRadius: normalize(14),
    borderWidth: 1,
    marginTop: normalize(10),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardColorStrip: {
    width: normalize(6),
  },
  cardMain: {
    flex: 1,
    padding: normalize(12),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(8),
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(8),
    gap: normalize(4),
  },
  timeText: {
    color: '#1D4ED8',
    fontSize: normalize(11),
    fontWeight: '700',
  },
  codeBadge: {
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(3),
    borderRadius: normalize(6),
  },
  codeText: {
    fontSize: normalize(10),
    fontWeight: '600',
  },
  subjectName: {
    fontSize: normalize(15),
    fontWeight: '700',
    lineHeight: normalize(20),
    marginBottom: normalize(8),
  },
  detailsContainer: {
    gap: normalize(4),
    marginBottom: normalize(10),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(6),
  },
  detailText: {
    fontSize: normalize(12),
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
    paddingTop: normalize(8),
    gap: normalize(8),
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(5),
    borderRadius: normalize(8),
    gap: normalize(4),
  },
  actionBtnText: {
    fontSize: normalize(11),
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: normalize(40),
    paddingHorizontal: normalize(20),
  },
  emptyIconCircle: {
    width: normalize(64),
    height: normalize(64),
    borderRadius: normalize(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(12),
  },
  emptyTitle: {
    fontSize: normalize(15),
    fontWeight: '700',
    marginBottom: normalize(6),
  },
  emptySubtitle: {
    fontSize: normalize(12),
    textAlign: 'center',
    lineHeight: normalize(18),
    marginBottom: normalize(16),
  },
  resetSeedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: normalize(14),
    paddingVertical: normalize(9),
    borderRadius: normalize(8),
    gap: normalize(6),
  },
  resetSeedBtnText: {
    color: '#2196F3',
    fontWeight: '700',
    fontSize: normalize(12),
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
  inputLabel: {
    fontSize: normalize(12),
    fontWeight: '700',
    marginTop: normalize(10),
    marginBottom: normalize(4),
  },
  textInput: {
    borderWidth: 1,
    borderRadius: normalize(8),
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(8),
    fontSize: normalize(13),
  },
  rowInputs: {
    flexDirection: 'row',
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: normalize(8),
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(9),
    gap: normalize(8),
  },
  timePickerValue: {
    fontSize: normalize(13),
    fontWeight: '700',
  },
  modalDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: normalize(4),
  },
  modalDayChip: {
    paddingVertical: normalize(6),
    paddingHorizontal: normalize(10),
    borderRadius: normalize(8),
  },
  modalDayChipText: {
    fontSize: normalize(11),
    fontWeight: '700',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    gap: normalize(10),
    marginVertical: normalize(8),
  },
  colorCircle: {
    width: normalize(28),
    height: normalize(28),
    borderRadius: normalize(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    paddingVertical: normalize(12),
    borderRadius: normalize(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: normalize(18),
    marginBottom: normalize(12),
    flexDirection: 'row',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: normalize(13),
    fontWeight: '700',
  },
  pasteHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(8),
    borderRadius: normalize(10),
    gap: normalize(4),
  },
  pasteHeaderButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: normalize(12),
  },
  clipboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: normalize(14),
    marginBottom: normalize(8),
    padding: normalize(10),
    borderRadius: normalize(12),
    borderWidth: 1,
    gap: normalize(8),
  },
  clipboardDot: {
    width: normalize(10),
    height: normalize(10),
    borderRadius: normalize(5),
  },
  clipboardTitle: {
    fontSize: normalize(12),
    fontWeight: '700',
  },
  clipboardSubtitle: {
    fontSize: normalize(10),
    marginTop: normalize(1),
  },
  clipboardActionPaste: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(6),
    borderRadius: normalize(8),
    gap: normalize(4),
  },
  clipboardActionPasteText: {
    color: '#FFFFFF',
    fontSize: normalize(11),
    fontWeight: '700',
  },
  clipboardCloseBtn: {
    padding: normalize(4),
  },
  copyIconBadge: {
    width: normalize(32),
    height: normalize(32),
    borderRadius: normalize(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCopyCard: {
    flexDirection: 'row',
    borderRadius: normalize(10),
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: normalize(4),
  },
  previewColorStrip: {
    width: normalize(6),
  },
  previewMateriaTitle: {
    fontSize: normalize(14),
    fontWeight: '700',
  },
  previewMateriaSub: {
    fontSize: normalize(11),
    marginTop: normalize(2),
  },
  previewMateriaDocente: {
    fontSize: normalize(11),
    marginTop: normalize(2),
    fontStyle: 'italic',
  },
  copyTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: normalize(10),
    borderRadius: normalize(8),
    marginTop: normalize(14),
    gap: normalize(8),
  },
  copyTipText: {
    fontSize: normalize(11),
    lineHeight: normalize(16),
    flex: 1,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingVertical: normalize(10),
    borderRadius: normalize(10),
    marginBottom: normalize(14),
    gap: normalize(6),
  },
  cancelBtnText: {
    fontSize: normalize(12),
    fontWeight: '600',
  },
  careerStatsSub: {
    fontSize: normalize(10),
    fontWeight: '600',
    marginTop: normalize(2),
  },
  tabSegmentContainer: {
    flexDirection: 'row',
    marginHorizontal: normalize(14),
    marginTop: normalize(6),
    marginBottom: normalize(4),
    padding: normalize(3),
    borderRadius: normalize(10),
  },
  tabSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(7),
    borderRadius: normalize(8),
    gap: normalize(6),
  },
  tabSegmentBtnActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabSegmentText: {
    fontSize: normalize(12),
  },
  subjectListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: normalize(10),
    paddingBottom: normalize(6),
    gap: normalize(8),
  },
  subjectGroupCard: {
    flexDirection: 'row',
    borderRadius: normalize(14),
    borderWidth: 1,
    marginTop: normalize(10),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  subjectGroupMain: {
    flex: 1,
    padding: normalize(12),
  },
  subjectGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(8),
    gap: normalize(4),
  },
  sessionCountBadgeText: {
    fontSize: normalize(11),
    fontWeight: '700',
    color: '#2563EB',
  },
  sessionsSubList: {
    marginTop: normalize(6),
    marginBottom: normalize(8),
    gap: normalize(6),
  },
  sessionsSectionTitle: {
    fontSize: normalize(11),
    fontWeight: '600',
    marginBottom: normalize(2),
  },
  sessionRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: normalize(8),
    borderRadius: normalize(8),
    borderWidth: 1,
  },
  sessionDayChip: {
    backgroundColor: '#2563EB',
    paddingHorizontal: normalize(7),
    paddingVertical: normalize(3),
    borderRadius: normalize(6),
  },
  sessionDayChipText: {
    color: '#FFFFFF',
    fontSize: normalize(10),
    fontWeight: '700',
  },
  sessionTimeText: {
    fontSize: normalize(11),
    fontWeight: '700',
  },
  sessionAulaText: {
    fontSize: normalize(10),
    marginTop: normalize(1),
  },
  sessionDeleteBtn: {
    padding: normalize(4),
  },
  subjectGroupActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
    paddingTop: normalize(8),
    gap: normalize(8),
  },
  modalQuickSubjectsWrap: {
    marginBottom: normalize(12),
  },
  modalQuickSubjectsLabel: {
    fontSize: normalize(11),
    fontWeight: '600',
    marginBottom: normalize(6),
  },
  modalQuickSubjectsRow: {
    gap: normalize(6),
    paddingVertical: normalize(2),
  },
  quickSubjectChip: {
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(6),
    borderRadius: normalize(8),
    borderWidth: 1,
    maxWidth: normalize(160),
  },
  quickSubjectChipText: {
    fontSize: normalize(11),
    fontWeight: '700',
  },
});
