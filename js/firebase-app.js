// js/firebase-app.js

// 1. Import menggunakan link CDN langsung
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// 2. Config Firebase milik Anda (dari screenshot)
const firebaseConfig = {
  apiKey: "AIzaSyDhOwQCmaj0gU7f0XhGT3slmXo_YM0OQHE",
  authDomain: "dp2kbpmd-absensi-online.firebaseapp.com",
  projectId: "dp2kbpmd-absensi-online",
  storageBucket: "dp2kbpmd-absensi-online.firebasestorage.app",
  messagingSenderId: "974725204998",
  appId: "1:974725204998:web:63f0a9f1845e44626d4787"
};

// 3. Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// 4. Export db dan storage agar bisa dipakai di app.js
export const db = getFirestore(app);
export const storage = getStorage(app);