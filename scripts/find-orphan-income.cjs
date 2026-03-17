const admin = require('firebase-admin');
const path = require('path');
if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // Build a set of all real payment IDs from playerFinances
  const pfSnap = await db.collection('playerFinances').get();
  const realPaymentIds = new Set();
  const realPaymentsByPlayer = {};

  for (const d of pfSnap.docs) {
    const data = d.data();
    const payments = data.payments || [];
    for (const p of payments) {
      realPaymentIds.add(p.id);
      if (!realPaymentsByPlayer[data.playerId]) realPaymentsByPlayer[data.playerId] = [];
      realPaymentsByPlayer[data.playerId].push({ id: p.id, amount: p.amount, financeId: d.id });
    }
  }

  console.log('Real payment IDs in playerFinances:', realPaymentIds.size);

  // Check income records
  const incSnap = await db.collection('income').get();
  let matched = 0, orphan = 0;
  let matchedAmt = 0, orphanAmt = 0;
  const orphans = [];

  for (const d of incSnap.docs) {
    const data = d.data();
    if (data.category !== 'player_payments') continue;

    const spId = data.sourcePaymentId;
    if (spId && realPaymentIds.has(spId)) {
      matched++;
      matchedAmt += data.amount || 0;
    } else {
      orphan++;
      orphanAmt += data.amount || 0;
      orphans.push({
        id: d.id,
        amount: data.amount,
        source: data.source,
        desc: data.description,
        playerId: data.playerId,
        sourcePaymentId: spId || '(none)',
        sourceFinanceId: data.sourceFinanceId || '(none)',
      });
    }
  }

  console.log('\n=== PLAYER_PAYMENTS INCOME RECORDS ===');
  console.log(`Matched to real payments: ${matched} ($${matchedAmt.toFixed(2)})`);
  console.log(`Orphans (no matching payment): ${orphan} ($${orphanAmt.toFixed(2)})`);

  if (orphans.length > 0) {
    console.log('\n--- Orphan details (first 20) ---');
    for (const o of orphans.slice(0, 20)) {
      console.log(`  ${o.id} | $${o.amount} | ${o.source} | ${o.desc} | player:${o.playerId} | spId:${o.sourcePaymentId}`);
    }
  }

  console.log('\n=== WHAT REPORTS SHOULD SHOW ===');
  const sponsorIncome = incSnap.docs
    .filter(d => d.data().category !== 'player_payments')
    .reduce((s, d) => s + (d.data().amount || 0), 0);
  console.log(`Player payments (from playerFinances): $${Array.from(realPaymentIds).length} payments`);
  console.log(`  Total paid: $${pfSnap.docs.reduce((s, d) => s + (d.data().payments || []).reduce((ps, p) => ps + (p.amount || 0), 0), 0).toFixed(2)}`);
  console.log(`Non-player income records: $${sponsorIncome.toFixed(2)}`);
  console.log(`Correct total income: $${(pfSnap.docs.reduce((s, d) => s + (d.data().payments || []).reduce((ps, p) => ps + (p.amount || 0), 0), 0) + sponsorIncome).toFixed(2)}`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
