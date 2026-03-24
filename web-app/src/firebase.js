import { initializeApp } from "firebase/app";
// เปลี่ยนมาใช้คำสั่ง initializeFirestore สำหรับเวอร์ชันใหม่
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";


// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA640RLvAsqWWFilv4JUqFmHUjaEttGWJc",
    authDomain: "pile-tracker.firebaseapp.com",
    projectId: "pile-tracker",
    storageBucket: "pile-tracker.firebasestorage.app",
    messagingSenderId: "607456231968",
    appId: "1:607456231968:web:d989639d47f7e46bc5f245"
};

const app = initializeApp(firebaseConfig);

// เปิดใช้งานฐานข้อมูล พร้อมระบบ Offline Support (ทนทานต่อเน็ตหลุด)
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
