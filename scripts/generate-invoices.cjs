/**
 * One-time script: Generate individual invoices for all players with outstanding balances.
 * Reads all playerFinances, creates an invoice token per charge type where amount > 0.
 * Skips any charge that already has an active (unused + unexpired) invoice.
 *
 * Usage: node scripts/generate-invoices.js [--dry-run]
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const path = require('path');

// Init
const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');

const CHARGE_LABELS = {
  registrationFee: 'Registration Fee',
  uniformCost: 'Uniform Cost',
  tournamentFees: 'Tournament Fees',
  facilityFees: 'Facility Fees',
  equipmentFees: 'Equipment Fees',
  otherFees: 'Other Fees',
};
const CHARGE_FIELDS = Object.keys(CHARGE_LABELS);

async function getNextInvoiceNumber() {
  const counterRef = db.collection('appSettings').doc('invoiceCounter');
  const year = new Date().getFullYear();

  const result = await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let currentCount = 0;
    let currentYear = year;

    if (counterDoc.exists) {
      const data = counterDoc.data();
      currentYear = data.year || year;
      currentCount = data.count || 0;
    }

    if (currentYear !== year) {
      currentCount = 0;
    }

    const nextCount = currentCount + 1;
    transaction.set(counterRef, { year, count: nextCount }, { merge: true });
    return nextCount;
  });

  const padded = String(result).padStart(4, '0');
  return `INV-${year}-${padded}`;
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN MODE ===' : '=== LIVE MODE ===');
  console.log('');

  // 1. Fetch all playerFinances
  const financesSnapshot = await db.collection('playerFinances').get();
  console.log(`Found ${financesSnapshot.size} player finance records`);

  // 2. Fetch all existing active invoice tokens
  const existingTokensSnapshot = await db
    .collection('invoiceTokens')
    .where('used', '==', false)
    .get();

  const now = new Date();
  const activeInvoiceKeys = new Set();
  existingTokensSnapshot.forEach((doc) => {
    const t = doc.data();
    const expiresAt = t.expiresAt?.toDate ? t.expiresAt.toDate() : new Date(t.expiresAt);
    if (expiresAt > now) {
      activeInvoiceKeys.add(`${t.playerId}:${t.chargeType}`);
    }
  });
  console.log(`Found ${activeInvoiceKeys.size} active invoice keys (will skip these)`);
  console.log('');

  // 3. Process each finance record
  let created = 0;
  let skipped = 0;
  let noBalance = 0;
  const errors = [];

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiry

  const dueDateValue = new Date(expiresAt); // Due date = expiry date

  for (const financeDoc of financesSnapshot.docs) {
    const financeData = financeDoc.data();
    const playerId = financeData.playerId;
    const playerName = financeData.playerName || 'Unknown';

    // Calculate total paid
    const totalPaid = (financeData.payments || []).reduce(
      (sum, p) => sum + (p.amount || 0),
      0
    );

    for (const chargeType of CHARGE_FIELDS) {
      const chargeAmount = financeData[chargeType] || 0;
      if (chargeAmount <= 0) {
        noBalance++;
        continue;
      }

      const key = `${playerId}:${chargeType}`;
      if (activeInvoiceKeys.has(key)) {
        console.log(`  SKIP  ${playerName} - ${CHARGE_LABELS[chargeType]} ($${chargeAmount}) [already invoiced]`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  WOULD CREATE  ${playerName} - ${CHARGE_LABELS[chargeType]}: $${chargeAmount.toFixed(2)}`);
        created++;
        continue;
      }

      try {
        const token = crypto.randomUUID();
        const invoiceNumber = await getNextInvoiceNumber();

        const tokenDoc = {
          financeId: financeDoc.id,
          playerId,
          playerName: financeData.playerName || '',
          teamName: financeData.teamName || '',
          season: financeData.season || '',
          amountDue: chargeAmount,
          chargeType,
          chargeLabel: CHARGE_LABELS[chargeType],
          chargeAmount,
          registrationFee: financeData.registrationFee || 0,
          uniformCost: financeData.uniformCost || 0,
          tournamentFees: financeData.tournamentFees || 0,
          facilityFees: financeData.facilityFees || 0,
          equipmentFees: financeData.equipmentFees || 0,
          otherFees: financeData.otherFees || 0,
          scholarshipAmount: financeData.scholarshipAmount || 0,
          totalPaid,
          token,
          invoiceNumber,
          dueDate: admin.firestore.Timestamp.fromDate(dueDateValue),
          paymentTerms: 'Net 30',
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          createdBy: 'system-script',
          createdAt: admin.firestore.Timestamp.now(),
          used: false,
        };

        await db.collection('invoiceTokens').add(tokenDoc);
        activeInvoiceKeys.add(key); // prevent dups within this run
        created++;
        console.log(`  CREATED  ${playerName} - ${CHARGE_LABELS[chargeType]}: $${chargeAmount.toFixed(2)}  [${invoiceNumber}]`);
      } catch (err) {
        errors.push(`${playerName} - ${CHARGE_LABELS[chargeType]}: ${err.message}`);
        console.error(`  ERROR  ${playerName} - ${CHARGE_LABELS[chargeType]}: ${err.message}`);
      }
    }
  }

  console.log('');
  console.log('=== SUMMARY ===');
  console.log(`Created: ${created}`);
  console.log(`Skipped (already invoiced): ${skipped}`);
  console.log(`Skipped (no balance): ${noBalance}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('Error details:');
    errors.forEach((e) => console.log(`  - ${e}`));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
