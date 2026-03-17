const admin = require('firebase-admin');
const path = require('path');
if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // Get Mariah's finance record
  const doc = await db.collection('playerFinances').doc('mariah-gibel-2025-2026').get();
  const d = doc.data();
  console.log('=== Finance Record ===');
  console.log('Fees:');
  console.log('  registrationFee:', d.registrationFee || 0);
  console.log('  uniformCost:', d.uniformCost || 0);
  console.log('  tournamentFees:', d.tournamentFees || 0);
  console.log('  facilityFees:', d.facilityFees || 0);
  console.log('  equipmentFees:', d.equipmentFees || 0);
  console.log('  otherFees:', d.otherFees || 0);
  console.log('  scholarshipAmount:', d.scholarshipAmount || 0);
  const totalOwed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
  console.log('  totalOwed (computed):', totalOwed);
  console.log('  totalOwed (stored):', d.totalOwed);
  const payments = d.payments || [];
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  console.log('  totalPaid (computed):', totalPaid);
  console.log('  totalPaid (stored):', d.totalPaid);
  console.log('  balanceDue (stored):', d.balanceDue);
  console.log('  balance (computed):', totalOwed - totalPaid - (d.scholarshipAmount || 0));
  console.log('  Payments:', payments.length);
  for (const p of payments) {
    console.log('    -', p.id, '$' + p.amount, p.method);
  }

  // Get invoice tokens
  const tokSnap = await db.collection('invoiceTokens').where('playerId', '==', 'mariah-gibel').get();
  console.log('\n=== Invoice Tokens ===');
  for (const t of tokSnap.docs) {
    const td = t.data();
    console.log('  Token:', t.id);
    console.log('    chargeType:', td.chargeType, '| chargeLabel:', td.chargeLabel);
    console.log('    amountDue:', td.amountDue, '| chargeAmount:', td.chargeAmount);
    console.log('    totalPaid (snapshot):', td.totalPaid);
    console.log('    used:', td.used);
    console.log('    invoiceNumber:', td.invoiceNumber);
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
