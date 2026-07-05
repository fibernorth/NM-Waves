/**
 * Apply the agreed reconciliation fixes so the app matches reality as the
 * go-forward source of truth. SAFE BY DEFAULT: dry run unless --apply, and
 * every step is idempotent (re-running does not double or drift).
 *
 *   Balances (playerFinances): set each player's outstanding balance to a target
 *     - Ruby Gorman   -> $450 (quit, still owed)
 *     - Zuliette Marsh-> $250 (undo the quit-redistribution bump from $450)
 *   Donations (income, category 'donations'): record overpayments as donations
 *     - Courtney Hardy-> $185
 *     - Maya Dorman   -> $50
 *   (Both players stay at $0 balance — no negatives.)
 *
 * Usage (project root, needs serviceAccountKey.json):
 *   node scripts/apply-reconciliation-fixes.cjs            # dry run
 *   node scripts/apply-reconciliation-fixes.cjs --apply    # write changes
 */
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();
const apply = process.argv.includes('--apply');
const money = (n) => `$${(Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2)}`;

const BALANCE_TARGETS = [
  { name: 'Ruby Gorman', target: 450 },
  { name: 'Zuliette Marsh', target: 250 },
];
const DONATIONS = [
  { name: 'Courtney Hardy', amount: 185 },
  { name: 'Maya Dorman', amount: 50 },
];

const feeTotal = (d) =>
  (d.registrationFee || 0) + (d.uniformCost || 0) + (d.tournamentFees || 0) +
  (d.facilityFees || 0) + (d.equipmentFees || 0) + (d.otherFees || 0);

async function financeDocFor(name) {
  const snap = await db.collection('playerFinances').where('playerName', '==', name).get();
  if (snap.empty) return null;
  // Prefer the current 2025-2026 season if there are multiple.
  const docs = snap.docs;
  return docs.find((d) => String(d.data().season || '').includes('2025') || String(d.data().season || '').includes('2026')) || docs[0];
}

async function main() {
  console.log(`\n=== Reconciliation fixes — ${apply ? 'APPLY' : 'DRY RUN (no changes)'} ===\n`);

  // ---- Balance targets ----
  console.log('BALANCES:');
  for (const { name, target } of BALANCE_TARGETS) {
    const doc = await financeDocFor(name);
    if (!doc) { console.log(`  ! ${name}: no finance record found — skipped`); continue; }
    const d = doc.data();
    const paid = (d.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    const scholarship = d.scholarshipAmount || 0;
    const current = feeTotal(d) - paid - scholarship;
    const delta = target - current;
    const newOther = Math.round(((d.otherFees || 0) + delta) * 100) / 100;
    console.log(`  ${name}: current ${money(current)} -> target ${money(target)} (otherFees ${money(d.otherFees || 0)} -> ${money(newOther)})`);
    if (apply && Math.abs(delta) > 0.005) {
      await doc.ref.update({ otherFees: newOther, updatedAt: admin.firestore.Timestamp.now() });
    }
  }

  // ---- Donations (idempotent via referenceNumber marker) ----
  console.log('\nDONATIONS (category: donations):');
  for (const { name, amount } of DONATIONS) {
    const ref = `overpayment-donation-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const existing = await db.collection('income').where('referenceNumber', '==', ref).limit(1).get();
    if (!existing.empty) { console.log(`  = ${name}: ${money(amount)} donation already recorded — skipped`); continue; }
    console.log(`  + ${name}: record ${money(amount)} donation`);
    if (apply) {
      await db.collection('income').add({
        date: admin.firestore.Timestamp.now(),
        category: 'donations',
        amount,
        source: name,
        description: `Overpayment from ${name} recorded as a donation`,
        payerName: name,
        paymentMethod: 'other',
        referenceNumber: ref,
        reconciled: false,
        recordedBy: 'reconciliation-script',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
  }

  console.log(apply
    ? '\nDone. Changes written.'
    : '\nDRY RUN — nothing written. Re-run with --apply to make these changes.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
