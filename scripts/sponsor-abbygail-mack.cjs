// Apply FiberNorth sponsorship to Abbygail Mack for her $610 open balance
const admin = require('firebase-admin');
const path = require('path');
const crypto = require('crypto');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  const pfSnap = await db.collection('playerFinances').get();

  for (const doc of pfSnap.docs) {
    const d = doc.data();
    if ((d.playerName || '').toLowerCase() !== 'abbygail mack') continue;

    const owed = (d.registrationFee||0)+(d.uniformCost||0)+(d.tournamentFees||0)+(d.facilityFees||0)+(d.equipmentFees||0)+(d.otherFees||0);
    const existingPaid = (d.payments||[]).reduce((s, p) => s + (p.amount||0), 0);
    const balance = owed - existingPaid - (d.scholarshipAmount||0);

    console.log('BEFORE:');
    console.log('  Owed: $' + owed + ' | Paid: $' + existingPaid + ' | Scholarship: $' + (d.scholarshipAmount||0) + ' | Balance: $' + balance);

    // Add FiberNorth sponsor payment for the open balance
    const sponsorPayment = {
      id: crypto.randomUUID(),
      amount: balance,
      date: admin.firestore.Timestamp.fromDate(new Date(2026, 2, 16)), // today
      method: 'sponsor',
      sponsorName: 'FiberNorth, Inc.',
      sponsorId: '',
      notes: 'FiberNorth, Inc. sponsorship',
    };

    const finalPayments = [...(d.payments || []), sponsorPayment];
    const totalPaid = finalPayments.reduce((s, p) => s + (p.amount||0), 0);

    console.log('AFTER:');
    console.log('  Sponsor payment: $' + balance + ' from FiberNorth, Inc.');
    console.log('  Total paid: $' + totalPaid + ' | Balance: $0 | Status: paid');

    await doc.ref.update({
      payments: finalPayments,
      totalPaid,
      balanceDue: 0,
      status: 'paid',
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // Mark her invoice tokens as used
    const tokSnap = await db.collection('invoiceTokens').get();
    for (const tokDoc of tokSnap.docs) {
      const t = tokDoc.data();
      if ((t.playerName || '').toLowerCase() === 'abbygail mack' && !t.used) {
        await tokDoc.ref.update({
          used: true,
          paidBy: 'FiberNorth, Inc. (sponsor)',
          paidAt: admin.firestore.Timestamp.now(),
        });
        console.log('  Marked token ' + t.invoiceNumber + ' (QB #' + (t.qbInvoiceNumber||'N/A') + ') $' + t.amountDue + ' as paid');
      }
    }

    console.log('Done.');
    break;
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
