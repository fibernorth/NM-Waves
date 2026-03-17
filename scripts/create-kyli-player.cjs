// Create Kyli Hellebuyck player record
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  const playerId = 'kyli-hellebuyck';

  // Get her finance record for the playerId
  const finDoc = await db.collection('playerFinances').doc('LnUWGX10nmB3KmwXtjQR').get();
  const finData = finDoc.data();
  const storedPlayerId = finData.playerId;
  console.log('Finance playerId:', storedPlayerId);

  // Use the playerId from finance if it exists, otherwise use our generated one
  const pid = storedPlayerId || playerId;

  await db.collection('players').doc(pid).set({
    firstName: 'Kyli',
    lastName: 'Hellebuyck',
    teamId: 'nm-waves-2026-13u',
    teamName: 'NM Waves 2026 13U',
    parentEmail: 'travelhub@gmail.com',
    parentName: '',
    parentPhone: '',
    contacts: [{
      name: '',
      relationship: 'Parent',
      email: 'travelhub@gmail.com',
      phone: '',
      isPrimaryContact: true,
      isFinancialParty: true,
    }],
    positions: [],
    active: true,
    emergencyContact: '',
    emergencyPhone: '',
    notes: '',
    medicalNotes: '',
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  console.log('Created player: ' + pid);

  // Update finance record with team info and correct playerId
  await db.collection('playerFinances').doc('LnUWGX10nmB3KmwXtjQR').update({
    playerId: pid,
    teamId: 'nm-waves-2026-13u',
    teamName: 'NM Waves 2026 13U',
    updatedAt: admin.firestore.Timestamp.now(),
  });
  console.log('Updated finance record');

  // Update invoice token with correct playerId
  const tokSnap = await db.collection('invoiceTokens').where('invoiceNumber', '==', 'INV-2026-0118').get();
  for (const doc of tokSnap.docs) {
    await doc.ref.update({
      playerId: pid,
      teamName: 'NM Waves 2026 13U',
    });
    console.log('Updated invoice token');
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
