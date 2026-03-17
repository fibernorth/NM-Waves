// Fix stale invoice tokens: mark as "used" when the player's finance record shows
// the charge has been fully covered by payments (even if paid outside the invoice system).
//
// Usage: node scripts/fix-invoice-tokens.cjs [--dry-run]

const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const dryRun = process.argv.includes('--dry-run');

// Compute total fees owed (mirrors frontend computeFeeTotal)
function computeFeeTotal(data) {
  return (data.registrationFee || 0) +
    (data.uniformCost || 0) +
    (data.tournamentFees || 0) +
    (data.facilityFees || 0) +
    (data.equipmentFees || 0) +
    (data.otherFees || 0);
}

async function main() {
  console.log(`\n=== Fix Stale Invoice Tokens ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // Load all playerFinances
  const finSnap = await db.collection('playerFinances').get();
  const finMap = {};
  for (const doc of finSnap.docs) {
    finMap[doc.id] = doc.data();
  }

  // Load all invoice tokens
  const tokenSnap = await db.collection('invoiceTokens').get();
  let fixedCount = 0;
  let alreadyGoodCount = 0;

  for (const tokenDoc of tokenSnap.docs) {
    const token = tokenDoc.data();

    // Skip already-used tokens
    if (token.used) {
      alreadyGoodCount++;
      continue;
    }

    const finData = finMap[token.financeId];
    if (!finData) continue;

    const totalOwed = computeFeeTotal(finData);
    const totalPaid = (finData.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const scholarship = finData.scholarshipAmount || 0;
    const balanceDue = totalOwed - totalPaid - scholarship;

    // Check if the specific charge type has been covered
    let chargeCovered = false;

    if (token.chargeType === 'full_balance') {
      chargeCovered = balanceDue <= 0;
    } else {
      // Per-charge: check if the specific fee + total payments cover it
      // If overall balance is <= 0, all individual charges are covered
      chargeCovered = balanceDue <= 0;
    }

    if (chargeCovered) {
      console.log(`  FIX: ${tokenDoc.id} | ${token.invoiceNumber} | ${token.playerName} | ${token.chargeLabel} $${token.amountDue} → marking used (balance: $${balanceDue.toFixed(2)})`);
      if (!dryRun) {
        await tokenDoc.ref.update({
          used: true,
          usedAt: admin.firestore.Timestamp.now(),
          usedBy: 'system_reconciliation',
          notes: `Auto-reconciled: player balance is $${balanceDue.toFixed(2)} (paid outside invoice system)`,
        });
      }
      fixedCount++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Already used: ${alreadyGoodCount}`);
  console.log(`  Fixed (marked used): ${fixedCount}`);
  console.log(`  Total tokens: ${tokenSnap.size}`);
  if (dryRun) console.log(`\n  This was a dry run. Run without --dry-run to apply.`);
  console.log('');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
