// Fix Skylar Yanska status - should be 'paid' not 'overdue'
// Sponsor covered everything, balance is $0
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  const pfSnap = await db.collection('playerFinances').get();

  for (const doc of pfSnap.docs) {
    const d = doc.data();
    if ((d.playerName || '').toLowerCase().includes('skylar') && (d.playerName || '').toLowerCase().includes('yanska')) {
      console.log('Skylar Yanska:');
      console.log('  Current status:', d.status);
      console.log('  balanceDue:', d.balanceDue);
      console.log('  totalPaid:', d.totalPaid || (d.payments||[]).reduce((s,p)=>s+(p.amount||0),0));

      // She's paid in full by sponsor - set balance to 0 and status to 'paid'
      await doc.ref.update({
        balanceDue: 0,
        status: 'paid',
        updatedAt: admin.firestore.Timestamp.now(),
      });
      console.log('  -> status: paid, balanceDue: 0');
    }
  }

  // While we're at it, fix status for ALL sponsored players
  const sponsoredNames = ['abigail gaylord', 'katie vandergriff', 'mackenzie tobian', 'callie magee'];
  for (const doc of pfSnap.docs) {
    const d = doc.data();
    const name = (d.playerName || '').toLowerCase();
    if (sponsoredNames.includes(name)) {
      const owed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
      const paid = (d.payments||[]).reduce((s,p)=>s+(p.amount||0), 0);
      const scholarship = d.scholarshipAmount || 0;
      const balance = Math.max(0, owed - paid - scholarship);

      if (balance === 0 && d.status !== 'paid') {
        console.log(d.playerName + ': ' + d.status + ' -> paid');
        await doc.ref.update({ status: 'paid', balanceDue: 0, updatedAt: admin.firestore.Timestamp.now() });
      }
    }
  }

  console.log('Done.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
