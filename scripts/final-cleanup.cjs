// Final cleanup:
// 1. Add QB #48 to Kyli Hellebuyck's existing INV-2026-0118 token
// 2. Mark Skylar Yanska's invoice tokens as used (paid by sponsor)
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  const tokSnap = await db.collection('invoiceTokens').get();

  for (const doc of tokSnap.docs) {
    const d = doc.data();

    // Add QB #48 to Kyli's token
    if (d.invoiceNumber === 'INV-2026-0118') {
      console.log('Kyli: Adding QB #48 to ' + d.invoiceNumber);
      await doc.ref.update({ qbInvoiceNumber: '48' });
    }

    // Mark Skylar's tokens as used (paid by Yanska Investments sponsorship)
    if ((d.playerName || '').toLowerCase().includes('skylar') && (d.playerName || '').toLowerCase().includes('yanska') && !d.used) {
      console.log('Skylar: Marking ' + d.invoiceNumber + ' (QB #' + (d.qbInvoiceNumber || 'N/A') + ') $' + d.amountDue + ' as used (sponsor paid)');
      await doc.ref.update({
        used: true,
        paidBy: 'Yanska Investments (sponsor)',
        paidAt: admin.firestore.Timestamp.now(),
      });
    }
  }

  console.log('Done.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
