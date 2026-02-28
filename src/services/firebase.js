import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCrBaUN0keLVmEf-GXrevjSd6jHkvw7vaQ",
  authDomain: "maismedicos-dev.firebaseapp.com",
  projectId: "maismedicos-dev",
  storageBucket: "maismedicos-dev.firebasestorage.app",
  messagingSenderId: "246883613981",
  appId: "1:246883613981:web:7bc776fd192046203ff5f4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
