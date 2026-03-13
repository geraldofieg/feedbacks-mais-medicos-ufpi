import { getStorage } from 'firebase/storage';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDZ7iAX0BMOazbrooDwsLDqLZO4IpwOkdA",
  authDomain: "feedbacks-mais-medicos-novo.firebaseapp.com",
  projectId: "feedbacks-mais-medicos-novo",
  storageBucket: "feedbacks-mais-medicos-novo.firebasestorage.app",
  messagingSenderId: "390908095939",
  appId: "1:390908095939:web:f8cd055c90c8d26e666176"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
