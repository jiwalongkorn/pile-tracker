// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries



// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA640RLvAsqWWFilv4JUqFmHUjaEttGWJc",
    authDomain: "pile-tracker.firebaseapp.com",
    projectId: "pile-tracker",
    storageBucket: "pile-tracker.firebasestorage.app",
    messagingSenderId: "607456231968",
    appId: "1:607456231968:web:d989639d47f7e46bc5f245"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// สั่งเปิดใช้งานฐานข้อมูล Firestore
export const db = getFirestore(app);