// Fix double-counting: sponsor payments are now in payments[] array,
// so scholarshipAmount should be 0 (the payment itself covers it)
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const sponsoredPlayers = [
  'Abigail Gaylord',
  'Katie Vandergriff',
  'Mackenzie Tobian',
  'Skylar Yanska',
];

async function main() {
  const pfSnap = await db.collection('playerFinances').get();

  for (const doc of pfSnap.docs) {
    const d = doc.data();
    const name = d.playerName || '';

    if (!sponsoredPlayers.some(sp => sp.toLowerCase() === name.toLowerCase())) continue;

    const owed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
    const totalPaid = (d.payments||[]).reduce((s, p) => s + (p.amount || 0), 0);
    const balance = Math.max(0, owed - totalPaid);

    console.log(name + ':');
    console.log('  Owed: $' + owed + ' | Paid: $' + totalPaid + ' | Old scholarship: $' + (d.scholarshipAmount||0));
    console.log('  New scholarship: $0 | New balance: $' + balance);

    await doc.ref.update({
      scholarshipAmount: 0,
      totalPaid,
      balanceDue: balance,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  }

  // Also fix Callie Magee - she has $250 credit memo but no sponsor payment
  // Her scholarship should stay as $250 since it's a QB credit memo, not a sponsor payment
  // Let's verify her state
  for (const doc of pfSnap.docs) {
    const d = doc.data();
    if ((d.playerName || '').toLowerCase().includes('callie magee')) {
      const owed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
      const paid = (d.payments||[]).reduce((s, p) => s + (p.amount || 0), 0);
      console.log('\nCallie Magee (verify):');
      console.log('  Owed: $' + owed + ' | Paid: $' + paid + ' | Scholarship: $' + (d.scholarshipAmount||0));
      console.log('  Balance: $' + (owed - paid - (d.scholarshipAmount||0)));
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
