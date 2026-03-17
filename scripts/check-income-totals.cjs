const admin = require('firebase-admin');
const path = require('path');
if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  const incSnap = await db.collection('income').get();

  let total = 0;
  const byCat = {};
  const dupes = {};

  for (const d of incSnap.docs) {
    const data = d.data();
    const amt = data.amount || 0;
    const cat = data.category || 'unknown';
    total += amt;
    byCat[cat] = (byCat[cat] || 0) + amt;

    // Track potential duplicates (sourcePaymentId)
    if (data.sourcePaymentId) {
      if (!dupes[data.sourcePaymentId]) dupes[data.sourcePaymentId] = [];
      dupes[data.sourcePaymentId].push({ id: d.id, amount: amt, source: data.source, desc: data.description });
    }
  }

  console.log('=== INCOME TOTALS ===');
  console.log('Total records:', incSnap.size);
  console.log('Grand total: $' + total.toFixed(2));
  console.log('\nBy category:');
  for (const [cat, amt] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: $${amt.toFixed(2)}`);
  }

  // Check for duplicate sourcePaymentIds
  const dupEntries = Object.entries(dupes).filter(([, v]) => v.length > 1);
  if (dupEntries.length > 0) {
    console.log('\n=== DUPLICATE sourcePaymentId ENTRIES ===');
    for (const [spId, entries] of dupEntries) {
      console.log(`\n  sourcePaymentId: ${spId}`);
      for (const e of entries) {
        console.log(`    ${e.id} | $${e.amount} | ${e.source} | ${e.desc}`);
      }
    }
  } else {
    console.log('\nNo duplicate sourcePaymentId entries found.');
  }

  // Now check what playerFinances says total payments are
  const pfSnap = await db.collection('playerFinances').get();
  let pfTotalPaid = 0;
  let pfTotalOwed = 0;
  for (const d of pfSnap.docs) {
    const data = d.data();
    const payments = data.payments || [];
    for (const p of payments) {
      pfTotalPaid += p.amount || 0;
    }
    pfTotalOwed += (data.registrationFee || 0) + (data.uniformCost || 0) +
      (data.tournamentFees || 0) + (data.facilityFees || 0) +
      (data.equipmentFees || 0) + (data.otherFees || 0);
  }
  console.log('\n=== PLAYER FINANCES ===');
  console.log('Total owed (charges): $' + pfTotalOwed.toFixed(2));
  console.log('Total paid (payments): $' + pfTotalPaid.toFixed(2));
  console.log('Outstanding: $' + (pfTotalOwed - pfTotalPaid).toFixed(2));

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
