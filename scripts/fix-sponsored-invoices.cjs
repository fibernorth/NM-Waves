// Mark sponsored players' invoices as paid (scholarship covers them)
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // Sponsored players whose balances are $0 due to scholarships
  const sponsoredPlayers = ['abigail-gaylord', 'katie-vandergriff', 'mackenzie-tobian'];

  const tokSnap = await db.collection('invoiceTokens').get();
  let fixed = 0;

  for (const doc of tokSnap.docs) {
    const d = doc.data();
    if (!sponsoredPlayers.includes(d.playerId)) continue;
    if (d.used) continue;

    console.log('Marking as paid: ' + d.playerName + ' - ' + d.invoiceNumber + ' (QB #' + d.qbInvoiceNumber + ') $' + d.amountDue);
    await doc.ref.update({
      used: true,
      usedAt: admin.firestore.Timestamp.now(),
      usedBy: 'sponsor_coverage',
    });
    fixed++;
  }

  // Also mark Callie Magee's invoices as paid (she has a $250 credit memo = scholarship)
  const callieSnap = await db.collection('invoiceTokens').where('playerName', '==', 'Callie Magee').get();
  for (const doc of callieSnap.docs) {
    const d = doc.data();
    if (d.used) continue;
    // The $250 invoice is covered by the credit memo (scholarship), the $100 is paid
    console.log('Marking as paid: ' + d.playerName + ' - ' + d.invoiceNumber + ' $' + d.amountDue);
    await doc.ref.update({
      used: true,
      usedAt: admin.firestore.Timestamp.now(),
      usedBy: 'credit_memo_coverage',
    });
    fixed++;
  }

  console.log('\nFixed ' + fixed + ' invoice tokens');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
