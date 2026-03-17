/**
 * Delete orphan income records (player_payments with no matching sourcePaymentId
 * in playerFinances) and their corresponding GL entries.
 * Usage: node scripts/cleanup-orphan-income.cjs
 */
const admin = require('firebase-admin');
const path = require('path');
if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // Build set of real payment IDs from playerFinances
  const pfSnap = await db.collection('playerFinances').get();
  const realPaymentIds = new Set();
  for (const d of pfSnap.docs) {
    for (const p of (d.data().payments || [])) {
      realPaymentIds.add(p.id);
    }
  }
  console.log('Real payment IDs:', realPaymentIds.size);

  // Find orphan income records (player_payments with no matching sourcePaymentId)
  const incSnap = await db.collection('income').get();
  const orphanIds = [];
  for (const d of incSnap.docs) {
    const data = d.data();
    if (data.category !== 'player_payments') continue;
    const spId = data.sourcePaymentId;
    if (!spId || !realPaymentIds.has(spId)) {
      orphanIds.push(d.id);
    }
  }
  console.log('Found ' + orphanIds.length + ' orphan income records to delete');

  // Find GL entries that reference these orphan income records
  const glSnap = await db.collection('generalLedger').get();
  const glToDelete = [];
  const orphanSet = new Set(orphanIds);
  for (const d of glSnap.docs) {
    const data = d.data();
    if (data.sourceType === 'income' && data.sourceId && orphanSet.has(data.sourceId)) {
      glToDelete.push(d.id);
    }
  }
  console.log('Found ' + glToDelete.length + ' GL entries to delete');

  // Delete in batches of 500 (Firestore limit)
  const BATCH_SIZE = 500;

  // Delete orphan income records
  console.log('\nDeleting orphan income records...');
  for (let i = 0; i < orphanIds.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = orphanIds.slice(i, i + BATCH_SIZE);
    for (const id of chunk) {
      batch.delete(db.collection('income').doc(id));
    }
    await batch.commit();
    console.log('  Deleted income batch ' + (Math.floor(i / BATCH_SIZE) + 1) + ' (' + chunk.length + ' records)');
  }

  // Delete corresponding GL entries
  console.log('Deleting orphan GL entries...');
  for (let i = 0; i < glToDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = glToDelete.slice(i, i + BATCH_SIZE);
    for (const id of chunk) {
      batch.delete(db.collection('generalLedger').doc(id));
    }
    await batch.commit();
    console.log('  Deleted GL batch ' + (Math.floor(i / BATCH_SIZE) + 1) + ' (' + chunk.length + ' records)');
  }

  // Verify
  const incAfter = await db.collection('income').get();
  const glAfter = await db.collection('generalLedger').get();
  const playerPaymentsAfter = incAfter.docs.filter(d => d.data().category === 'player_payments');
  const totalIncome = incAfter.docs.reduce((s, d) => s + (d.data().amount || 0), 0);
  const pfTotal = pfSnap.docs.reduce((s, d) => s + (d.data().payments || []).reduce((ps, p) => ps + (p.amount || 0), 0), 0);

  console.log('\n=== AFTER CLEANUP ===');
  console.log('Income records: ' + incAfter.size);
  console.log('  player_payments: ' + playerPaymentsAfter.length + ' ($' + playerPaymentsAfter.reduce((s, d) => s + (d.data().amount || 0), 0).toFixed(2) + ')');
  console.log('  non-player: $' + incAfter.docs.filter(d => d.data().category !== 'player_payments').reduce((s, d) => s + (d.data().amount || 0), 0).toFixed(2));
  console.log('Total income: $' + totalIncome.toFixed(2));
  console.log('Player finances total paid: $' + pfTotal.toFixed(2));
  console.log('GL entries: ' + glAfter.size);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
