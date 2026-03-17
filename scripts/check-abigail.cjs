const admin = require('firebase-admin');
const path = require('path');
if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // Find player
  const pSnap = await db.collection('players').get();
  for (const d of pSnap.docs) {
    const data = d.data();
    const name = ((data.firstName || '') + ' ' + (data.lastName || '')).toLowerCase();
    if (name.includes('abigail') || name.includes('gaylord')) {
      console.log('=== PLAYER ===');
      console.log('ID:', d.id);
      console.log('Name:', data.firstName, data.lastName);
      console.log('teamId:', data.teamId);
      console.log('parentUserId:', data.parentUserId);
      console.log('parentEmail:', data.parentEmail);
    }
  }

  // Find playerFinances
  const fSnap = await db.collection('playerFinances').get();
  for (const d of fSnap.docs) {
    const data = d.data();
    const name = (data.playerName || '').toLowerCase();
    if (name.includes('abigail') || name.includes('gaylord')) {
      console.log('\n=== PLAYER FINANCES ===');
      console.log('ID:', d.id);
      console.log('playerId:', data.playerId);
      console.log('playerName:', data.playerName);
      console.log('season:', data.season);
      console.log('registrationFee:', data.registrationFee);
      console.log('uniformCost:', data.uniformCost);
      console.log('tournamentFees:', data.tournamentFees);
      console.log('facilityFees:', data.facilityFees);
      console.log('equipmentFees:', data.equipmentFees);
      console.log('otherFees:', data.otherFees);
      console.log('scholarshipAmount:', data.scholarshipAmount);
      const payments = (data.payments || []).map(p => ({
        id: p.id, amount: p.amount,
        date: p.date && p.date.toDate ? p.date.toDate().toISOString() : p.date,
        method: p.method,
      }));
      console.log('payments:', JSON.stringify(payments, null, 2));
    }
  }

  // Find invoiceTokens
  const iSnap = await db.collection('invoiceTokens').get();
  let invoiceCount = 0;
  for (const d of iSnap.docs) {
    const data = d.data();
    const match = (data.playerName || '').toLowerCase().includes('abigail') ||
      (data.playerName || '').toLowerCase().includes('gaylord') ||
      (data.playerId || '').toLowerCase().includes('abigail') ||
      (data.playerId || '').toLowerCase().includes('gaylord');
    if (match) {
      invoiceCount++;
      console.log('\n=== INVOICE TOKEN ===');
      console.log('ID:', d.id);
      console.log('playerId:', data.playerId);
      console.log('playerName:', data.playerName);
      console.log('financeId:', data.financeId);
      console.log('chargeType:', data.chargeType);
      console.log('chargeLabel:', data.chargeLabel);
      console.log('amountDue:', data.amountDue);
      console.log('used:', data.used);
      console.log('invoiceNumber:', data.invoiceNumber);
    }
  }
  console.log('\nTotal invoice tokens found:', invoiceCount);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
