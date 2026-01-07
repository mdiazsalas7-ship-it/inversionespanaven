
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAyQKdLaQYbFDowTfMHHgiE6q7N2ES2434",
  authDomain: "invpanaven-e69c6.firebaseapp.com",
  projectId: "invpanaven-e69c6",
  storageBucket: "invpanaven-e69c6.firebasestorage.app",
  messagingSenderId: "526242542092",
  appId: "1:526242542092:web:431c53efe290b40457b429"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
