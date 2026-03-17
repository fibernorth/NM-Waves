// Fix Abbygail Mack's stored totalPaid and balanceDue
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  const docRef = db.collection('playerFinances').doc('abbygail-mack-2025-2026');
  const doc = await docRef.get();
  const d = doc.data();

  const payments = d.payments || [];
  const computedPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const computedOwed = (d.registrationFee||0) + (d.uniformCost||0) + (d.tournamentFees||0) + (d.facilityFees||0) + (d.equipmentFees||0) + (d.otherFees||0);
  const computedBalance = computedOwed - computedPaid - (d.scholarshipAmount || 0);

  console.log('Before: totalPaid=' + d.totalPaid + ' balanceDue=' + d.balanceDue);
  console.log('After:  totalPaid=' + computedPaid + ' balanceDue=' + computedBalance);

  await docRef.update({
    totalPaid: computedPaid,
    balanceDue: computedBalance,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  console.log('Fixed.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
