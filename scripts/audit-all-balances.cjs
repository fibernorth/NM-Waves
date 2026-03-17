// Audit all player finance records for consistency
// Checks: stored vs computed totalOwed, totalPaid, balanceDue
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  const snap = await db.collection('playerFinances').get();
  let issues = 0;
  let total = 0;

  console.log('=== Player Finance Audit ===\n');

  for (const doc of snap.docs) {
    total++;
    const d = doc.data();
    const name = d.playerName || doc.id;
    const season = d.season || '?';

    // Compute totalOwed from fee fields
    const computedOwed =
      (d.registrationFee || 0) +
      (d.uniformCost || 0) +
      (d.tournamentFees || 0) +
      (d.facilityFees || 0) +
      (d.equipmentFees || 0) +
      (d.otherFees || 0);

    // Compute totalPaid from payments array
    const payments = d.payments || [];
    const computedPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

    // Compute balance
    const scholarship = d.scholarshipAmount || 0;
    const computedBalance = computedOwed - computedPaid - scholarship;

    // Check stored values
    const storedOwed = d.totalOwed;
    const storedPaid = d.totalPaid;
    const storedBalance = d.balanceDue;

    const owedMismatch = storedOwed !== undefined && Math.abs(storedOwed - computedOwed) > 0.01;
    const paidMismatch = storedPaid !== undefined && Math.abs(storedPaid - computedPaid) > 0.01;
    const balanceMismatch = storedBalance !== undefined && Math.abs(storedBalance - computedBalance) > 0.01;

    if (owedMismatch || paidMismatch || balanceMismatch) {
      issues++;
      console.log(`MISMATCH: ${name} (${season}) [${doc.id}]`);
      if (owedMismatch) console.log(`  totalOwed: stored=${storedOwed} computed=${computedOwed}`);
      if (paidMismatch) console.log(`  totalPaid: stored=${storedPaid} computed=${computedPaid}`);
      if (balanceMismatch) console.log(`  balanceDue: stored=${storedBalance} computed=${computedBalance}`);
      console.log(`  Fees: reg=${d.registrationFee||0} uni=${d.uniformCost||0} tourn=${d.tournamentFees||0} fac=${d.facilityFees||0} equip=${d.equipmentFees||0} other=${d.otherFees||0}`);
      console.log(`  Scholarship: ${scholarship} | Payments: ${payments.length} totaling $${computedPaid}`);
      console.log('');
    }
  }

  // Also check for duplicate payments (same id appearing twice)
  console.log('=== Duplicate Payment Check ===\n');
  let dupes = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const payments = d.payments || [];
    const ids = payments.map(p => p.id).filter(Boolean);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      dupes++;
      console.log(`DUPLICATE: ${d.playerName} (${d.season}) has duplicate payment IDs`);
      const counts = {};
      for (const id of ids) {
        counts[id] = (counts[id] || 0) + 1;
      }
      for (const [id, count] of Object.entries(counts)) {
        if (count > 1) console.log(`  ${id}: appears ${count} times`);
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total finance records: ${total}`);
  console.log(`Records with mismatches: ${issues}`);
  console.log(`Records with duplicate payments: ${dupes}`);
  if (issues === 0 && dupes === 0) console.log('ALL RECORDS CONSISTENT');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
