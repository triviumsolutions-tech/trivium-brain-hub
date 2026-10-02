import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAVFVj3GpRmbs_--kHEiBNjNKYXf7PY0k8",
  authDomain: "trivium-brain-hub.firebaseapp.com",
  projectId: "trivium-brain-hub",
  storageBucket: "trivium-brain-hub.firebasestorage.app",
  messagingSenderId: "92397806652",
  appId: "1:92397806652:web:5a88a49d4e1cd9c379cf39",
  measurementId: "G-S24MQBVY4V"
};

// Inicializa o Firebase garantindo que não duplique instâncias no Next.js (Hot Reload)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
