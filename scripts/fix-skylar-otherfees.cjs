// Fix Skylar Yanska - otherFees was inflated to $1400 when scholarship existed,
// then scholarship was removed but otherFees wasn't corrected.
// QB shows she owes $750 total (4 invoices: $250+$100+$250+$150)
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // Find Skylar's finance record
  const pfSnap = await db.collection('playerFinances').get();
  let skylar = null;
  for (const doc of pfSnap.docs) {
    const d = doc.data();
    if ((d.playerName || '').toLowerCase().includes('skylar') && (d.playerName || '').toLowerCase().includes('yanska')) {
      skylar = { id: doc.id, ref: doc.ref, data: d };
      break;
    }
  }

  if (!skylar) {
    console.log('Skylar Yanska finance record NOT FOUND');
    process.exit(1);
  }

  const d = skylar.data;
  console.log('BEFORE:');
  console.log('  registrationFee:', d.registrationFee || 0);
  console.log('  uniformCost:', d.uniformCost || 0);
  console.log('  tournamentFees:', d.tournamentFees || 0);
  console.log('  facilityFees:', d.facilityFees || 0);
  console.log('  equipmentFees:', d.equipmentFees || 0);
  console.log('  otherFees:', d.otherFees || 0);
  console.log('  scholarshipAmount:', d.scholarshipAmount || 0);
  const currentOwed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
  const currentPaid = (d.payments||[]).reduce((s, p) => s + (p.amount || 0), 0);
  console.log('  totalOwed:', currentOwed);
  console.log('  totalPaid:', currentPaid);
  console.log('  balance:', currentOwed - currentPaid - (d.scholarshipAmount||0));

  // QB says she owes $750 total. No payments, no scholarship.
  // targetOwed = $750
  // otherFees = 750 - (reg + uniform + tournament + facility + equipment)
  const fixedFees = (d.registrationFee||0) + (d.uniformCost||0) + (d.tournamentFees||0) + (d.facilityFees||0) + (d.equipmentFees||0);
  const targetOtherFees = Math.max(0, 750 - fixedFees);

  console.log('\nAFTER:');
  console.log('  otherFees:', targetOtherFees);
  console.log('  totalOwed:', fixedFees + targetOtherFees);
  console.log('  scholarshipAmount: 0');
  console.log('  balanceDue: 750');

  await skylar.ref.update({
    otherFees: targetOtherFees,
    totalOwed: 750,
    scholarshipAmount: 0,
    balanceDue: 750,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  console.log('\nFixed Skylar Yanska.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
