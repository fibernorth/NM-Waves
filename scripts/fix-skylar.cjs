// Fix Skylar Yanska - sponsored by Yanska Investments ($1,000)
// Her total owed is $750, fully covered by sponsorship
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  const ref = db.collection('playerFinances').doc('skylar-yanska-2025-2026');
  const doc = await ref.get();
  const d = doc.data();

  const owed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);

  // Yanska Investments paid $1,000 but Skylar only owes $750
  // Set scholarship to cover the full amount
  const scholarship = owed; // $750

  console.log('Skylar Yanska: owed=$' + owed + ' scholarship=$' + scholarship + ' balance=$' + (owed - scholarship));

  await ref.update({
    scholarshipAmount: scholarship,
    totalPaid: 0,
    balanceDue: 0,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  console.log('Fixed.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
