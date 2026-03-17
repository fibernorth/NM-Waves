// Find all records for Gibal / Mariah
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

function matches(text) {
  const lower = text.toLowerCase();
  return lower.includes('gibal') || lower.includes('mariah');
}

async function main() {
  // Search players
  console.log('=== Players ===');
  const pSnap = await db.collection('players').get();
  const playerIds = [];
  for (const doc of pSnap.docs) {
    const d = doc.data();
    const text = [d.lastName, d.firstName, d.parentName, d.parentEmail].join(' ');
    if (matches(text)) {
      playerIds.push(doc.id);
      console.log('  Player ID:', doc.id);
      console.log('  Name:', d.firstName, d.lastName);
      console.log('  Parent:', d.parentName, '|', d.parentEmail);
    }
  }

  // Search playerFinances
  console.log('\n=== playerFinances ===');
  const pfSnap = await db.collection('playerFinances').get();
  for (const doc of pfSnap.docs) {
    const d = doc.data();
    const nameMatch = matches(d.playerName || '');
    const idMatch = playerIds.includes(d.playerId);
    if (nameMatch || idMatch) {
      console.log('  Finance Doc ID:', doc.id);
      console.log('  Player:', d.playerName, '| playerId:', d.playerId, '| season:', d.season);
      console.log('  Total Paid: $' + (d.totalPaid || 0));
      const payments = d.payments || [];
      console.log('  Payments (' + payments.length + '):');
      for (const p of payments) {
        console.log('    - id:' + p.id + ' $' + p.amount + ' method:' + p.method + ' stripe:' + (p.stripeSessionId || 'none') + ' date:' + (p.date && p.date.toDate ? p.date.toDate().toISOString() : p.date));
      }
    }
  }

  // Search income
  console.log('\n=== Income ===');
  const incSnap = await db.collection('income').get();
  for (const doc of incSnap.docs) {
    const d = doc.data();
    const text = JSON.stringify(d);
    if (matches(text) || playerIds.includes(d.playerId)) {
      console.log('  Income ID:', doc.id, '| $' + d.amount, '|', d.description, '| sourcePaymentId:', d.sourcePaymentId);
    }
  }

  // Search GL
  console.log('\n=== General Ledger ===');
  const glSnap = await db.collection('generalLedger').get();
  for (const doc of glSnap.docs) {
    const d = doc.data();
    const text = JSON.stringify(d);
    if (matches(text) || playerIds.includes(d.playerId)) {
      console.log('  GL ID:', doc.id, '| $' + d.amount, '|', d.description);
    }
  }

  // Also check Stripe checkout sessions collection if it exists
  try {
    console.log('\n=== Stripe Sessions (checkout_sessions) ===');
    const ssSnap = await db.collection('checkout_sessions').get();
    for (const doc of ssSnap.docs) {
      const d = doc.data();
      const text = JSON.stringify(d);
      if (matches(text)) {
        console.log('  Session ID:', doc.id, '| status:', d.status, '| amount:', d.amount);
      }
    }
  } catch (e) {
    console.log('  (no checkout_sessions collection)');
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
