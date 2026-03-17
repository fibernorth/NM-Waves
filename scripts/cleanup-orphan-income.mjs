// Cleanup script: Remove orphaned income records that were auto-created from
// player payments but whose payments were later deleted.
//
// These orphans happen because removePayment() previously didn't cascade-delete
// the income records. This script finds and removes them.
//
// Usage: node scripts/cleanup-orphan-income.mjs [--dry-run]

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBudHBD7L6rEZCvHJ41QBAnA67Mb_mWIY0",
  authDomain: "tcw-website-builder.firebaseapp.com",
  projectId: "tcw-website-builder",
  storageBucket: "tcw-website-builder.firebasestorage.app",
  messagingSenderId: "110366167929",
  appId: "1:110366167929:web:f0d76d7eea8dee70e755a8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== Cleanup Orphaned Income Records ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE DELETE'}\n`);

  // 1. Get all playerFinances and build a set of all existing payment IDs
  const finSnap = await getDocs(collection(db, 'playerFinances'));
  const existingPaymentIds = new Set();
  for (const d of finSnap.docs) {
    const payments = d.data().payments || [];
    for (const p of payments) {
      if (p.id) existingPaymentIds.add(p.id);
    }
  }
  console.log(`Found ${existingPaymentIds.size} existing payment IDs across ${finSnap.size} playerFinances docs.`);

  // 2. Get all income records that were auto-created from player payments
  const incSnap = await getDocs(collection(db, 'income'));
  let orphanCount = 0;
  let keptCount = 0;

  for (const incDoc of incSnap.docs) {
    const data = incDoc.data();

    // Check if this income record has a sourcePaymentId (new format)
    if (data.sourcePaymentId) {
      if (!existingPaymentIds.has(data.sourcePaymentId)) {
        console.log(`  ORPHAN (sourcePaymentId): ${incDoc.id} | ${data.source || ''} | $${data.amount || 0} | paymentId=${data.sourcePaymentId}`);
        if (!dryRun) {
          await deleteDoc(doc(db, 'income', incDoc.id));
          // Also delete GL entries linked to this income
          const glSnap = await getDocs(query(collection(db, 'generalLedger'), where('sourceId', '==', incDoc.id)));
          for (const glDoc of glSnap.docs) {
            await deleteDoc(glDoc.ref);
          }
        }
        orphanCount++;
      } else {
        keptCount++;
      }
      continue;
    }

    // For older records without sourcePaymentId: check if it's a player_payment
    // with a playerId that has a description matching "Payment for..."
    if (data.category === 'player_payments' && data.playerId && data.description?.startsWith('Payment for')) {
      // Try to find a matching payment in the playerFinances
      const matchingFin = finSnap.docs.find(f => f.data().playerId === data.playerId);
      if (matchingFin) {
        const payments = matchingFin.data().payments || [];
        const hasMatch = payments.some(p =>
          p.amount === data.amount &&
          Math.abs((p.date?.toDate?.() || new Date()).getTime() - (data.date?.toDate?.() || new Date()).getTime()) < 86400000 // within 1 day
        );
        if (!hasMatch) {
          console.log(`  ORPHAN (no matching payment): ${incDoc.id} | ${data.source || ''} | $${data.amount || 0} | player=${data.playerId}`);
          if (!dryRun) {
            await deleteDoc(doc(db, 'income', incDoc.id));
            const glSnap = await getDocs(query(collection(db, 'generalLedger'), where('sourceId', '==', incDoc.id)));
            for (const glDoc of glSnap.docs) {
              await deleteDoc(glDoc.ref);
            }
          }
          orphanCount++;
        } else {
          keptCount++;
        }
      } else {
        // No playerFinance record at all for this player — orphan
        console.log(`  ORPHAN (no finance record): ${incDoc.id} | ${data.source || ''} | $${data.amount || 0} | player=${data.playerId}`);
        if (!dryRun) {
          await deleteDoc(doc(db, 'income', incDoc.id));
          const glSnap = await getDocs(query(collection(db, 'generalLedger'), where('sourceId', '==', incDoc.id)));
          for (const glDoc of glSnap.docs) {
            await deleteDoc(glDoc.ref);
          }
        }
        orphanCount++;
      }
    }
  }

  console.log(`\nResults:`);
  console.log(`  Total income records: ${incSnap.size}`);
  console.log(`  Orphans found/deleted: ${orphanCount}`);
  console.log(`  Payment-linked kept: ${keptCount}`);
  if (dryRun) {
    console.log(`\n  This was a dry run. Run without --dry-run to delete.`);
  }
  console.log('');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
