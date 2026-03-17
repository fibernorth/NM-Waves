// Fix Kyli Hellebuyck - add to 13U team, set parent email, create invoice token
const admin = require('firebase-admin');
const path = require('path');
const crypto = require('crypto');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // Find the 13U team
  const teamsSnap = await db.collection('teams').get();
  let team13u = null;
  for (const doc of teamsSnap.docs) {
    const d = doc.data();
    const name = (d.name || '').toLowerCase();
    if (name.includes('13u') || name.includes('13 u')) {
      team13u = { id: doc.id, name: d.name };
      break;
    }
  }
  console.log('13U team:', team13u ? team13u.id + ' (' + team13u.name + ')' : 'NOT FOUND');

  // Find Kyli's player record
  const playersSnap = await db.collection('players').get();
  let kyliPlayer = null;
  for (const doc of playersSnap.docs) {
    const d = doc.data();
    if ((d.lastName || '').toLowerCase() === 'hellebuyck' || ((d.firstName || '').toLowerCase() === 'kyli' && (d.lastName || '').toLowerCase().includes('helle'))) {
      kyliPlayer = { id: doc.id, ref: doc.ref, data: d };
      break;
    }
  }

  if (kyliPlayer) {
    console.log('Found player: ' + kyliPlayer.id + ' - ' + kyliPlayer.data.firstName + ' ' + kyliPlayer.data.lastName);
    // Update team and parent email
    const updates = {
      parentEmail: 'travelhub@gmail.com',
      updatedAt: admin.firestore.Timestamp.now(),
    };
    if (team13u) {
      updates.teamId = team13u.id;
      updates.teamName = team13u.name;
    }
    await kyliPlayer.ref.update(updates);
    console.log('Updated player with email and team');
  } else {
    console.log('Kyli player record NOT FOUND');
  }

  // Find her finance record
  const pfSnap = await db.collection('playerFinances').get();
  let kyliFinance = null;
  for (const doc of pfSnap.docs) {
    const d = doc.data();
    if ((d.playerName || '').toLowerCase().includes('kyli') || (d.playerName || '').toLowerCase().includes('hellebuyck')) {
      kyliFinance = { id: doc.id, ref: doc.ref, data: d };
      break;
    }
  }

  if (kyliFinance) {
    console.log('Found finance: ' + kyliFinance.id);
    // Update team on finance record too
    if (team13u) {
      await kyliFinance.ref.update({
        teamId: team13u.id,
        teamName: team13u.name,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }

    // Create invoice token for $800
    const counterRef = db.collection('appSettings').doc('invoiceCounter');
    const counterDoc = await counterRef.get();
    const currentCount = counterDoc.exists ? (counterDoc.data().count || 0) : 0;
    const nextCount = currentCount + 1;
    await counterRef.set({ year: 2026, count: nextCount }, { merge: true });
    const invoiceNumber = 'INV-2026-' + String(nextCount).padStart(4, '0');

    const token = crypto.randomUUID();
    const invDate = new Date(2026, 2, 17); // today
    const expiresAt = new Date(2026, 11, 31, 23, 59, 59);

    await db.collection('invoiceTokens').add({
      financeId: kyliFinance.id,
      playerId: kyliFinance.data.playerId,
      playerName: kyliFinance.data.playerName || 'Kyli Hellebuyck',
      teamName: team13u ? team13u.name : '',
      season: kyliFinance.data.season || '2025-2026',
      amountDue: 800,
      chargeType: 'per_invoice',
      chargeLabel: 'Full Balance',
      chargeAmount: 800,
      registrationFee: kyliFinance.data.registrationFee || 0,
      uniformCost: kyliFinance.data.uniformCost || 0,
      tournamentFees: kyliFinance.data.tournamentFees || 0,
      facilityFees: kyliFinance.data.facilityFees || 0,
      equipmentFees: kyliFinance.data.equipmentFees || 0,
      otherFees: kyliFinance.data.otherFees || 0,
      scholarshipAmount: kyliFinance.data.scholarshipAmount || 0,
      totalPaid: 0,
      token,
      invoiceNumber,
      dueDate: admin.firestore.Timestamp.fromDate(invDate),
      paymentTerms: 'Due upon receipt',
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      createdBy: 'qb_import',
      createdAt: admin.firestore.Timestamp.now(),
      used: false,
    });

    console.log('Created invoice: ' + invoiceNumber + ' for $800');
  } else {
    console.log('Kyli finance record NOT FOUND');
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
