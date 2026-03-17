const admin = require('firebase-admin');
const path = require('path');
if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

function computeFeeTotal(data) {
  return (data.registrationFee || 0) + (data.uniformCost || 0) +
    (data.tournamentFees || 0) + (data.facilityFees || 0) +
    (data.equipmentFees || 0) + (data.otherFees || 0);
}

async function main() {
  const finSnap = await db.collection('playerFinances').get();
  const finMap = {};
  for (const doc of finSnap.docs) finMap[doc.id] = doc.data();

  const tokenSnap = await db.collection('invoiceTokens').get();

  console.log('\n=== ALL INVOICE TOKENS STATUS ===\n');
  console.log('OUTSTANDING tokens:');
  let outCount = 0;
  for (const doc of tokenSnap.docs) {
    const t = doc.data();
    if (t.used) continue;
    outCount++;
    const fin = finMap[t.financeId];
    let balanceInfo = 'NO FINANCE RECORD';
    if (fin) {
      const totalOwed = computeFeeTotal(fin);
      const totalPaid = (fin.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
      const scholarship = fin.scholarshipAmount || 0;
      const balanceDue = totalOwed - totalPaid - scholarship;
      const chargeAmt = t.chargeType === 'registrationFee' ? (fin.registrationFee || 0) :
        t.chargeType === 'otherFees' ? (fin.otherFees || 0) :
        t.chargeType === 'uniformCost' ? (fin.uniformCost || 0) :
        t.chargeType === 'tournamentFees' ? (fin.tournamentFees || 0) :
        t.chargeType === 'facilityFees' ? (fin.facilityFees || 0) :
        t.chargeType === 'equipmentFees' ? (fin.equipmentFees || 0) :
        totalOwed;
      balanceInfo = `owed=$${totalOwed} paid=$${totalPaid} schol=$${scholarship} balance=$${balanceDue.toFixed(2)} | charge(${t.chargeType})=$${chargeAmt}`;
    }
    const expired = t.expiresAt && t.expiresAt.toDate() < new Date();
    console.log(`  ${t.invoiceNumber} | ${t.playerName} | ${t.chargeLabel} $${t.amountDue} | ${expired ? 'EXPIRED' : 'ACTIVE'} | ${balanceInfo}`);
  }
  console.log(`\nTotal outstanding: ${outCount}`);

  console.log('\n\nUSED (paid) tokens:');
  let usedCount = 0;
  for (const doc of tokenSnap.docs) {
    const t = doc.data();
    if (!t.used) continue;
    usedCount++;
  }
  console.log(`Total used: ${usedCount}`);
  console.log(`\nGrand total: ${tokenSnap.size}`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
