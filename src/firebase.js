import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Reemplaza este bloque con el TUYO copiado de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA3AVSebqRz5Mn87lVs2lgqBwoOmhXznUY",
  authDomain: "ventas-rosa.firebaseapp.com",
  projectId: "ventas-rosa",
  storageBucket: "ventas-rosa.firebasestorage.app",
  messagingSenderId: "712278657812",
  appId: "1:712278657812:web:1d78fd8a6d46648171d001"
};

// Inicializa Firebase y exporta la base de datos
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);