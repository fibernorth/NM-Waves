// Fix script: Tag untagged player-payment income records with sourcePaymentId/sourceFinanceId
// so the reconciliation page can properly skip them (avoiding double-counting).
// Orphaned records (no matching payment) are deleted.
//
// Usage: node scripts/fix-income-tags.cjs [--dry-run]

const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== Fix Untagged Income Records ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // 1. Load all playerFinances
  const finSnap = await db.collection('playerFinances').get();
  const financesByPlayer = {};
  for (const doc of finSnap.docs) {
    const d = doc.data();
    if (!financesByPlayer[d.playerId]) financesByPlayer[d.playerId] = [];
    financesByPlayer[d.playerId].push({ id: doc.id, ...d });
  }

  // Build a set of already-claimed payment IDs (from income records that are already tagged)
  const incSnap = await db.collection('income').get();
  const claimedPaymentIds = new Set();
  for (const doc of incSnap.docs) {
    const d = doc.data();
    if (d.sourcePaymentId) claimedPaymentIds.add(d.sourcePaymentId);
  }

  let taggedCount = 0;
  let orphanCount = 0;
  let skippedCount = 0;

  for (const incDoc of incSnap.docs) {
    const data = incDoc.data();

    // Skip records that are already tagged
    if (data.sourcePaymentId || data.sourceFinanceId) {
      continue;
    }

    // Skip non-player-payment records (QB expenses, sponsorships, etc.)
    if (data.category !== 'player_payments') {
      continue;
    }

    // Skip QB invoice records (inv-* IDs) — these are historical QB data
    if (incDoc.id.startsWith('inv-')) {
      skippedCount++;
      continue;
    }

    const playerId = data.playerId;
    if (!playerId) continue;

    // Try to find a matching payment in playerFinances
    const playerFinances = financesByPlayer[playerId] || [];
    let matched = false;

    for (const fin of playerFinances) {
      const payments = fin.payments || [];
      for (const pmt of payments) {
        // Skip if this payment is already claimed by another income record
        if (claimedPaymentIds.has(pmt.id)) continue;

        const pmtDate = pmt.date?.toDate?.() || new Date(0);
        const incDate = data.date?.toDate?.() || new Date(0);
        const timeDiff = Math.abs(pmtDate.getTime() - incDate.getTime());

        // Match by amount + date within 1 day
        if (pmt.amount === data.amount && timeDiff < 86400000) {
          console.log(`  TAG: ${incDoc.id} | $${data.amount} | ${data.source} → payment ${pmt.id} in finance ${fin.id}`);
          if (!dryRun) {
            await incDoc.ref.update({
              sourcePaymentId: pmt.id,
              sourceFinanceId: fin.id,
            });
          }
          claimedPaymentIds.add(pmt.id);
          matched = true;
          taggedCount++;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      console.log(`  ORPHAN: ${incDoc.id} | $${data.amount} | ${data.source} | ${data.description}`);
      if (!dryRun) {
        // Delete GL entries
        const glSnap = await db.collection('generalLedger').where('sourceId', '==', incDoc.id).get();
        for (const glDoc of glSnap.docs) {
          console.log(`    Deleting GL entry: ${glDoc.id}`);
          await glDoc.ref.delete();
        }
        await incDoc.ref.delete();
      }
      orphanCount++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Tagged (matched to payment): ${taggedCount}`);
  console.log(`  Orphans deleted: ${orphanCount}`);
  console.log(`  QB invoices skipped: ${skippedCount}`);
  if (dryRun) {
    console.log(`\n  This was a dry run. Run without --dry-run to apply.`);
  }
  console.log('');
  process.exit(0);
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
