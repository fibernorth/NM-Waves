// Full audit of Abbygail Mack's financial records
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // Finance record
  const doc = await db.collection('playerFinances').doc('abbygail-mack-2025-2026').get();
  const d = doc.data();
  console.log('=== Finance Record ===');
  console.log('Fees: reg=' + (d.registrationFee||0) + ' uni=' + (d.uniformCost||0) + ' tourn=' + (d.tournamentFees||0) + ' fac=' + (d.facilityFees||0) + ' equip=' + (d.equipmentFees||0) + ' other=' + (d.otherFees||0));
  console.log('Scholarship:', d.scholarshipAmount || 0);
  const totalOwed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
  console.log('Total owed:', totalOwed);
  console.log('Stored totalPaid:', d.totalPaid, '| balanceDue:', d.balanceDue);

  const payments = d.payments || [];
  console.log('\nPayments (' + payments.length + '):');
  for (const p of payments) {
    const date = p.date && p.date.toDate ? p.date.toDate().toISOString() : p.date;
    console.log('  ' + p.id + ': $' + p.amount + ' | method: ' + p.method + ' | date: ' + date + ' | stripe: ' + (p.stripeSessionId || 'none') + ' | ref: ' + (p.reference || 'none'));
  }

  // Income records
  console.log('\n=== Income Records ===');
  const incSnap = await db.collection('income').get();
  for (const idoc of incSnap.docs) {
    const id = idoc.data();
    const text = JSON.stringify(id).toLowerCase();
    if (text.includes('abbygail') || text.includes('mack') || id.playerId === 'abbygail-mack') {
      console.log('  ' + idoc.id + ': $' + id.amount + ' | ' + id.description + ' | sourcePaymentId: ' + (id.sourcePaymentId || 'none'));
    }
  }

  // GL entries
  console.log('\n=== GL Entries ===');
  const glSnap = await db.collection('generalLedger').get();
  for (const gdoc of glSnap.docs) {
    const gd = gdoc.data();
    const text = JSON.stringify(gd).toLowerCase();
    if (text.includes('abbygail') || text.includes('mack')) {
      console.log('  ' + gdoc.id + ': $' + gd.amount + ' | ' + gd.type + ' | ' + gd.description + ' | acct: ' + gd.accountNumber);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
