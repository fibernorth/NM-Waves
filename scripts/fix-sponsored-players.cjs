// Fix sponsored players: remove fake "paid in full" payments, keep scholarship
// Also fix Courtney Hardy's extra credit and Ava Wilson's overpayment
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function fixPlayer(docId, removePaymentFilter, description) {
  const ref = db.collection('playerFinances').doc(docId);
  const doc = await ref.get();
  if (!doc.exists) { console.log('  NOT FOUND: ' + docId); return; }
  const d = doc.data();

  const oldPayments = d.payments || [];
  const newPayments = oldPayments.filter(p => !removePaymentFilter(p));
  const removed = oldPayments.length - newPayments.length;

  const newPaid = newPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalOwed = (d.registrationFee||0) + (d.uniformCost||0) + (d.tournamentFees||0) + (d.facilityFees||0) + (d.equipmentFees||0) + (d.otherFees||0);
  const scholarship = d.scholarshipAmount || 0;
  const newBalance = totalOwed - newPaid - scholarship;

  console.log(description);
  console.log('  Removed ' + removed + ' payment(s)');
  console.log('  owed=$' + totalOwed + ' paid=$' + newPaid + ' scholarship=$' + scholarship + ' balance=$' + newBalance);

  await ref.update({
    payments: newPayments,
    totalPaid: newPaid,
    balanceDue: newBalance,
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

async function main() {
  // Sponsored players: remove the fake "QB reconciliation - paid in full" payments
  await fixPlayer('abigail-gaylord-2025-2026',
    p => (p.notes || '').includes('reconciliation') || (p.notes || '').includes('paid in full'),
    'Abigail Gaylord (sponsored by FiberNorth)');

  await fixPlayer('katie-vandergriff-2025-2026',
    p => (p.notes || '').includes('reconciliation') || (p.notes || '').includes('paid in full'),
    'Katie Vandergriff (sponsored by Feola Holdings)');

  await fixPlayer('mackenzie-tobian-2025-2026',
    p => (p.notes || '').includes('reconciliation') || (p.notes || '').includes('paid in full'),
    'Mackenzie Tobian (sponsored by FiberNorth)');

  // Courtney Hardy: remove the $135 carry-forward credit (QB doesn't show it)
  await fixPlayer('courtney-hardy-2025-2026',
    p => (p.notes || '').includes('carry-forward') || (p.notes || '').includes('credit'),
    'Courtney Hardy (remove carry-forward credit)');

  console.log('\nDone.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
