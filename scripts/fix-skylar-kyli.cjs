// Fix Skylar Yanska (sponsored by Yanska Investments) and check Kyli Hellebuyck
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // Check Skylar Yanska
  const skylarSnap = await db.collection('playerFinances').get();
  for (const doc of skylarSnap.docs) {
    const d = doc.data();
    if ((d.playerName || '').toLowerCase().includes('yanska') || (d.playerName || '').toLowerCase().includes('skylar')) {
      const payments = d.payments || [];
      const paid = payments.reduce((s, p) => s + (p.amount || 0), 0);
      const owed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
      console.log('Skylar Yanska:', doc.id);
      console.log('  Fees: reg=' + (d.registrationFee||0) + ' other=' + (d.otherFees||0) + ' total=' + owed);
      console.log('  Paid: $' + paid + ' | Scholarship: $' + (d.scholarshipAmount||0) + ' | Balance: $' + (owed - paid - (d.scholarshipAmount||0)));
      console.log('  Payments:', payments.length);
      for (const p of payments) console.log('    $' + p.amount + ' ' + p.method + ' ' + (p.notes || ''));
    }
    if ((d.playerName || '').toLowerCase().includes('kyli') || (d.playerName || '').toLowerCase().includes('hellebuyck')) {
      const payments = d.payments || [];
      const paid = payments.reduce((s, p) => s + (p.amount || 0), 0);
      const owed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
      console.log('\nKyli Hellebuyck:', doc.id);
      console.log('  Fees: reg=' + (d.registrationFee||0) + ' other=' + (d.otherFees||0) + ' total=' + owed);
      console.log('  Paid: $' + paid + ' | Scholarship: $' + (d.scholarshipAmount||0) + ' | Balance: $' + (owed - paid - (d.scholarshipAmount||0)));
      console.log('  Payments:', payments.length);
      for (const p of payments) console.log('    $' + p.amount + ' ' + p.method + ' ' + (p.notes || ''));
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
