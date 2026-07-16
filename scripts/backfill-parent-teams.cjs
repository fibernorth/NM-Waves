/**
 * Backfill parent -> team associations for EXISTING links. For every player
 * that has both a teamId and one or more linkedUserIds (parents), this adds the
 * player's teamId to each linked parent's user.teamIds. This brings families
 * who linked before the auto-sync feature into line, so a parent is "on" every
 * team their linked children play for.
 *
 * teamIds only grants access alongside a coach/admin role, so this never
 * escalates a parent — it only records the association (schedule, roster, team
 * communications). arrayUnion makes it idempotent; safe to run repeatedly.
 *
 * Usage (project root, needs serviceAccountKey.json):
 *   node scripts/backfill-parent-teams.cjs           # dry run (prints only)
 *   node scripts/backfill-parent-teams.cjs --apply   # writes the changes
 */
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

async function main() {
  const playersSnap = await db.collection('players').get();

  // Collect, per parent uid, the set of teamIds they should have from children.
  const wanted = new Map(); // uid -> Set(teamId)
  let linkedPlayerCount = 0;

  for (const doc of playersSnap.docs) {
    const p = doc.data();
    const teamId = p.teamId;
    const linked = Array.isArray(p.linkedUserIds) ? p.linkedUserIds : [];
    if (!teamId || linked.length === 0) continue;
    linkedPlayerCount++;
    for (const uid of linked) {
      if (!wanted.has(uid)) wanted.set(uid, new Set());
      wanted.get(uid).add(teamId);
    }
  }

  console.log(
    `Scanned ${playersSnap.size} players; ${linkedPlayerCount} have a team + linked parents.`
  );
  console.log(`${wanted.size} distinct parent accounts to check.\n`);

  let toUpdate = 0;
  const writes = [];

  for (const [uid, teamSet] of wanted.entries()) {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      console.log(`  (skip) user ${uid} not found`);
      continue;
    }
    const current = new Set(userDoc.data().teamIds || []);
    const missing = [...teamSet].filter((t) => !current.has(t));
    if (missing.length === 0) continue;

    toUpdate++;
    const name = userDoc.data().displayName || userDoc.data().email || uid;
    console.log(`  ${name}: add team(s) ${missing.join(', ')}`);
    writes.push({ userRef, missing });
  }

  console.log(`\n${toUpdate} parent account(s) need team additions.`);

  if (!APPLY) {
    console.log('\nDry run — no changes written. Re-run with --apply to commit.');
    return;
  }

  for (const { userRef, missing } of writes) {
    await userRef.update({
      teamIds: admin.firestore.FieldValue.arrayUnion(...missing),
      updatedAt: admin.firestore.Timestamp.now(),
    });
  }
  console.log(`\nApplied. Updated ${writes.length} parent account(s).`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
