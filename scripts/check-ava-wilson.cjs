// Check Ava Wilson's finance data and invoice tokens
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // Find Ava Wilson's finance record
  const pfSnap = await db.collection('playerFinances').get();
  for (const doc of pfSnap.docs) {
    const d = doc.data();
    if ((d.playerName || '').toLowerCase().includes('ava') && (d.playerName || '').toLowerCase().includes('wilson')) {
      console.log('Finance ID:', doc.id);
      console.log('playerName:', d.playerName);
      console.log('registrationFee:', d.registrationFee || 0);
      console.log('uniformCost:', d.uniformCost || 0);
      console.log('tournamentFees:', d.tournamentFees || 0);
      console.log('facilityFees:', d.facilityFees || 0);
      console.log('equipmentFees:', d.equipmentFees || 0);
      console.log('otherFees:', d.otherFees || 0);
      console.log('scholarshipAmount:', d.scholarshipAmount || 0);
      const owed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
      console.log('totalOwed:', owed);
      console.log('payments:');
      for (const p of (d.payments || [])) {
        console.log('  ' + (p.date || 'no-date') + ' $' + p.amount + ' ' + (p.method || '') + ' ' + (p.notes || '') + (p.stripeSessionId ? ' [stripe:' + p.stripeSessionId.substring(0, 20) + '...]' : ''));
      }
      const paid = (d.payments||[]).reduce((s, p) => s + (p.amount || 0), 0);
      console.log('totalPaid:', paid);
      console.log('balance:', owed - paid - (d.scholarshipAmount||0));
      console.log('balanceDue field:', d.balanceDue);
    }
  }

  // Check invoice tokens
  const tokSnap = await db.collection('invoiceTokens').get();
  console.log('\nInvoice tokens for Ava Wilson:');
  for (const doc of tokSnap.docs) {
    const d = doc.data();
    if ((d.playerName || '').toLowerCase().includes('ava') && (d.playerName || '').toLowerCase().includes('wilson')) {
      console.log('  ' + d.invoiceNumber + ' QB#' + (d.qbInvoiceNumber || 'N/A') + ' $' + d.amountDue + ' used=' + d.used + ' label=' + (d.chargeLabel || ''));
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
