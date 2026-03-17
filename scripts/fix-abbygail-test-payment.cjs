// Remove Abbygail Mack's test Stripe payment and fix balance
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
  console.log('Before: ' + payments.length + ' payments, totalPaid=' + d.totalPaid);

  // Remove any test Stripe payments (session ID contains 'cs_test_')
  const cleanPayments = payments.filter(p => {
    if (p.stripeSessionId && p.stripeSessionId.includes('cs_test_')) {
      console.log('REMOVING test payment: ' + p.id + ' $' + p.amount);
      return false;
    }
    return true;
  });

  const newTotalPaid = cleanPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalOwed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
  const newBalance = totalOwed - newTotalPaid - (d.scholarshipAmount || 0);

  console.log('After: ' + cleanPayments.length + ' payments, totalPaid=' + newTotalPaid + ', balanceDue=' + newBalance);

  await docRef.update({
    payments: cleanPayments,
    totalPaid: newTotalPaid,
    balanceDue: newBalance,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  console.log('Fixed.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
