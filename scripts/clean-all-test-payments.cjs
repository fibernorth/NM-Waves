// Find and remove ALL test Stripe payments across all player finances
// Also clean any test income/GL records
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // 1. Clean test payments from playerFinances
  console.log('=== Cleaning test payments from playerFinances ===\n');
  const pfSnap = await db.collection('playerFinances').get();
  let fixedCount = 0;

  for (const doc of pfSnap.docs) {
    const d = doc.data();
    const payments = d.payments || [];
    const testPayments = payments.filter(p => p.stripeSessionId && p.stripeSessionId.includes('cs_test_'));

    if (testPayments.length > 0) {
      const cleanPayments = payments.filter(p => !(p.stripeSessionId && p.stripeSessionId.includes('cs_test_')));
      const newPaid = cleanPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const totalOwed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
      const newBalance = totalOwed - newPaid - (d.scholarshipAmount || 0);

      console.log(d.playerName + ': removing ' + testPayments.length + ' test payment(s)');
      for (const tp of testPayments) {
        console.log('  - ' + tp.id + ': $' + tp.amount);
      }
      console.log('  New totalPaid: $' + newPaid + ' | balanceDue: $' + newBalance);

      await doc.ref.update({
        payments: cleanPayments,
        totalPaid: newPaid,
        balanceDue: newBalance,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      fixedCount++;
    }
  }
  console.log('\nFixed ' + fixedCount + ' finance records');

  // 2. Clean test income records
  console.log('\n=== Cleaning test income records ===\n');
  const incSnap = await db.collection('income').get();
  let incDeleted = 0;
  for (const doc of incSnap.docs) {
    const d = doc.data();
    const ref = d.referenceNumber || d.sourcePaymentId || '';
    if (ref.includes('cs_test_') || ref.includes('stripe_cs_test_')) {
      console.log('Deleting income: ' + doc.id + ' | $' + d.amount + ' | ' + d.description);
      await doc.ref.delete();
      incDeleted++;
    }
  }
  console.log('Deleted ' + incDeleted + ' test income records');

  // 3. Clean test GL entries (linked to test income)
  console.log('\n=== Cleaning test GL entries ===\n');
  const glSnap = await db.collection('generalLedger').get();
  let glDeleted = 0;
  for (const doc of glSnap.docs) {
    const d = doc.data();
    const desc = (d.description || '').toLowerCase();
    const sourceId = d.sourceId || '';
    // Check if description contains 'test' in a stripe context, or if it references a deleted income
    if ((d.createdBy === 'stripe_webhook' || desc.includes('stripe')) &&
        (sourceId.includes('test') || desc.includes('cs_test_'))) {
      console.log('Deleting GL: ' + doc.id + ' | $' + d.amount + ' | ' + d.description);
      await doc.ref.delete();
      glDeleted++;
    }
  }
  console.log('Deleted ' + glDeleted + ' test GL entries');

  // 4. Clean test expenses (processing fees)
  console.log('\n=== Cleaning test expense records ===\n');
  const expSnap = await db.collection('expenses').get();
  let expDeleted = 0;
  for (const doc of expSnap.docs) {
    const d = doc.data();
    const notes = d.notes || '';
    if (notes.includes('cs_test_')) {
      console.log('Deleting expense: ' + doc.id + ' | $' + d.amount + ' | ' + d.description);
      await doc.ref.delete();
      expDeleted++;
    }
  }
  console.log('Deleted ' + expDeleted + ' test expense records');

  console.log('\n=== Done ===');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
