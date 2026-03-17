// Quick check: find any income records related to Abbygail Mack
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function main() {
  // Check income records
  const incSnap = await db.collection('income').get();
  console.log(`\n=== Income records mentioning Abbygail/Mack ===`);
  let count = 0;
  for (const doc of incSnap.docs) {
    const d = doc.data();
    const text = JSON.stringify(d).toLowerCase();
    if (text.includes('abbygail') || text.includes('mack')) {
      count++;
      console.log(`  ${doc.id}:`, JSON.stringify({
        source: d.source,
        description: d.description,
        amount: d.amount,
        category: d.category,
        playerId: d.playerId,
        sourcePaymentId: d.sourcePaymentId,
        sourceFinanceId: d.sourceFinanceId,
        date: d.date?.toDate?.()?.toISOString(),
      }, null, 2));
    }
  }
  console.log(`Found ${count} income records.`);

  // Check GL entries
  const glSnap = await db.collection('generalLedger').get();
  console.log(`\n=== GL entries mentioning Abbygail/Mack ===`);
  let glCount = 0;
  for (const doc of glSnap.docs) {
    const d = doc.data();
    const text = JSON.stringify(d).toLowerCase();
    if (text.includes('abbygail') || text.includes('mack')) {
      glCount++;
      console.log(`  ${doc.id}:`, JSON.stringify({
        description: d.description,
        amount: d.amount,
        type: d.type,
        sourceId: d.sourceId,
      }, null, 2));
    }
  }
  console.log(`Found ${glCount} GL entries.`);

  // Check reconciliation-related fields
  console.log(`\n=== playerFinances for Abbygail ===`);
  const pfSnap = await db.collection('playerFinances').get();
  for (const doc of pfSnap.docs) {
    const d = doc.data();
    if ((d.playerName || '').toLowerCase().includes('mack') || (d.playerName || '').toLowerCase().includes('abbygail')) {
      console.log(`  ${doc.id}: ${d.playerName} | payments: ${(d.payments || []).length} | season: ${d.season}`);
      for (const p of (d.payments || [])) {
        console.log(`    payment ${p.id}: $${p.amount} | ${p.date?.toDate?.()?.toISOString()} | incomeRecordId=${p.incomeRecordId || 'none'}`);
      }
    }
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
