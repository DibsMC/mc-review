import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDgRIOBrYDKFUkNJtcZGlgJc0SYG1hykV4",
  authDomain: "review-budz.firebaseapp.com",
  projectId: "review-budz",
  storageBucket: "review-budz.appspot.com",
  messagingSenderId: "1027179696879",
  appId: "1:1027179696879:web:3556825f1c48843c84011a",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
