/**
 * Fix user display names: replace child names with parent/contact names.
 *
 * For each user with 'parent' role:
 *   1. Look up their linkedPlayerIds
 *   2. For each linked player, find the contact whose email matches the user's email
 *   3. Use that contact's name as the display name
 *   4. If no contact match, fall back to the player's parentName field
 *
 * Also fixes pendingUsers collection the same way.
 */

const admin = require('firebase-admin');
const path = require('path');
if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function fixUserDisplayNames() {
  console.log('=== Fixing User Display Names ===\n');

  // 1. Fix active users
  const usersSnap = await db.collection('users').get();
  let fixedUsers = 0;
  let skippedUsers = 0;

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const roles = userData.roles || [userData.role];

    // Only fix parent accounts
    if (!roles.includes('parent')) {
      continue;
    }

    const email = userData.email;
    const currentName = userData.displayName || '';
    const linkedPlayerIds = userData.linkedPlayerIds || [];

    if (linkedPlayerIds.length === 0) {
      console.log(`  SKIP: ${email} — no linked players`);
      skippedUsers++;
      continue;
    }

    // Look through linked players for a contact that matches this email
    let bestName = null;

    for (const playerId of linkedPlayerIds) {
      try {
        const playerDoc = await db.collection('players').doc(playerId).get();
        if (!playerDoc.exists) continue;

        const playerData = playerDoc.data();
        const contacts = playerData.contacts || [];

        // Find the contact with matching email
        for (const contact of contacts) {
          if (contact.email && contact.email.toLowerCase() === email.toLowerCase()) {
            bestName = contact.name;
            break;
          }
        }

        // If found a match, use it
        if (bestName) break;

        // Fallback: use parentName if email matches parentEmail
        if (!bestName && playerData.parentEmail &&
            playerData.parentEmail.toLowerCase() === email.toLowerCase() &&
            playerData.parentName) {
          bestName = playerData.parentName;
        }
      } catch (err) {
        console.log(`  WARN: Could not read player ${playerId}: ${err.message}`);
      }
    }

    if (bestName && bestName !== currentName) {
      console.log(`  FIX: ${email}  "${currentName}" → "${bestName}"`);
      await userDoc.ref.update({
        displayName: bestName,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Also update Firebase Auth display name
      try {
        await admin.auth().updateUser(userDoc.id, { displayName: bestName });
      } catch (err) {
        console.log(`    WARN: Could not update Auth displayName: ${err.message}`);
      }

      fixedUsers++;
    } else if (!bestName) {
      console.log(`  SKIP: ${email} ("${currentName}") — no matching contact found in players`);
      skippedUsers++;
    } else {
      console.log(`  OK:   ${email} ("${currentName}") — already correct`);
      skippedUsers++;
    }
  }

  console.log(`\nUsers: ${fixedUsers} fixed, ${skippedUsers} skipped\n`);

  // 2. Fix pending users
  console.log('=== Fixing Pending User Display Names ===\n');
  const pendingSnap = await db.collection('pendingUsers').get();
  let fixedPending = 0;
  let skippedPending = 0;

  for (const pendingDoc of pendingSnap.docs) {
    const pendingData = pendingDoc.data();
    const email = pendingData.email;
    const currentName = pendingData.displayName || '';
    const linkedPlayerIds = pendingData.linkedPlayerIds || [];

    if (linkedPlayerIds.length === 0) {
      skippedPending++;
      continue;
    }

    let bestName = null;

    for (const playerId of linkedPlayerIds) {
      try {
        const playerDoc = await db.collection('players').doc(playerId).get();
        if (!playerDoc.exists) continue;

        const playerData = playerDoc.data();
        const contacts = playerData.contacts || [];

        for (const contact of contacts) {
          if (contact.email && contact.email.toLowerCase() === email.toLowerCase()) {
            bestName = contact.name;
            break;
          }
        }

        if (bestName) break;

        if (!bestName && playerData.parentEmail &&
            playerData.parentEmail.toLowerCase() === email.toLowerCase() &&
            playerData.parentName) {
          bestName = playerData.parentName;
        }
      } catch (err) {
        // skip
      }
    }

    if (bestName && bestName !== currentName) {
      console.log(`  FIX: ${email}  "${currentName}" → "${bestName}"`);
      await pendingDoc.ref.update({
        displayName: bestName,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      fixedPending++;
    } else {
      skippedPending++;
    }
  }

  console.log(`\nPending: ${fixedPending} fixed, ${skippedPending} skipped`);
  console.log('\nDone!');
}

fixUserDisplayNames().catch(console.error);
