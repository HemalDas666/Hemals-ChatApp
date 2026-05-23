import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBMLnucxfbjXi0Lf0TZEjT1Nd_1aXihTv4",
  authDomain: "learningdb-2e196.firebaseapp.com",
  databaseURL: "https://learningdb-2e196-default-rtdb.firebaseio.com",
  projectId: "learningdb-2e196",
  storageBucket: "learningdb-2e196.firebasestorage.app",
  messagingSenderId: "298577512231",
  appId: "1:298577512231:web:87c2d751da7202d1f24b02"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

console.log("Firebase Connected with Storage!");