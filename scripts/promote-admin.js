// Promote a user to master-admin in Firestore
// Usage: node scripts/promote-admin.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBudHBD7L6rEZCvHJ41QBAnA67Mb_mWIY0",
  authDomain: "tcw-website-builder.firebaseapp.com",
  projectId: "tcw-website-builder",
  storageBucket: "tcw-website-builder.firebasestorage.app",
  messagingSenderId: "110366167929",
  appId: "1:110366167929:web:f0d76d7eea8dee70e755a8",
};

const TARGET_EMAIL = 'tcwavessoftball@gmail.com';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function promoteUser() {
  try {
    // Find user by email in users collection
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', TARGET_EMAIL));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`No user found with email ${TARGET_EMAIL} in Firestore.`);
      console.log('Please sign up at http://localhost:5173/signup first, then re-run this script.');
      process.exit(1);
    }

    const userDoc = snapshot.docs[0];
    console.log(`Found user: ${userDoc.id}`);
    console.log(`Current role: ${userDoc.data().role}`);

    await updateDoc(doc(db, 'users', userDoc.id), {
      role: 'master-admin',
      permissions: {
        canEditRosters: true,
        canViewFinancials: true,
        canManageSchedules: true,
        canUploadMedia: true,
      },
      updatedAt: new Date(),
    });

    console.log(`Successfully promoted ${TARGET_EMAIL} to master-admin!`);
    console.log('Log out and log back in to see the changes.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

promoteUser();
