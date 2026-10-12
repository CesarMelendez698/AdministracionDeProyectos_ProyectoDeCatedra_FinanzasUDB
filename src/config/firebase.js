import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
// NUEVO: Importamos el inicializador de autenticación
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyCkHN_NPXdMbSnWA9IcEBGXDhEga8amMCQ",
  authDomain: "finanzasdesafio3.firebaseapp.com",
  projectId: "finanzasdesafio3",
  storageBucket: "finanzasdesafio3.firebasestorage.app",
  messagingSenderId: "472465478521",
  appId: "1:472465478521:web:66782676e046b3878655a8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore con soporte de persistencia offline (Caché local persistente)
// Permite consultar y registrar transacciones sin internet y sincronizarlas automáticamente al recuperar señal.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // Fallback seguro si ya estuviera inicializado o en entornos que no soporten IndexedDB nativo
  db = getFirestore(app);
}

// NUEVO: Inicializar Auth forzando la persistencia nativa con AsyncStorage (Garantiza el requisito)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Exportamos auth junto a db
export { db, auth };