// Fix user display names: should be parent name, not player name
// For each user with role=parent, find their linked players,
// get the parent/guardian contact name, and update if different
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const sa = require(path.resolve(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  // Load all players
  const playersSnap = await db.collection('players').get();
  const playersById = new Map();
  for (const doc of playersSnap.docs) {
    playersById.set(doc.id, { id: doc.id, ...doc.data() });
  }
  console.log(`Loaded ${playersById.size} players`);

  // Build map: email -> best parent name (from player contacts)
  const emailToParentName = new Map();
  for (const [, player] of playersById) {
    const contacts = player.contacts || [];
    // Also check legacy parentName/parentEmail
    if (player.parentEmail) {
      const name = player.parentName || '';
      if (name && name !== player.firstName && name !== `${player.firstName} ${player.lastName}`) {
        emailToParentName.set(player.parentEmail.toLowerCase(), name);
      }
    }
    for (const contact of contacts) {
      if (!contact.email) continue;
      const email = contact.email.toLowerCase();
      // Use contact name if it doesn't match the player's name
      if (contact.name && contact.name !== player.firstName && contact.name !== `${player.firstName} ${player.lastName}`) {
        emailToParentName.set(email, contact.name);
      }
    }
  }
  console.log(`Built parent name map for ${emailToParentName.size} emails`);

  // Check all users
  const usersSnap = await db.collection('users').get();
  let fixCount = 0;
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const email = (data.email || '').toLowerCase();
    const currentName = data.displayName || '';
    const parentName = emailToParentName.get(email);

    if (!parentName) continue;
    if (currentName === parentName) continue;

    // Check if current name matches a player name (meaning it's wrong)
    let isPlayerName = false;
    const linkedIds = data.linkedPlayerIds || [];
    for (const pid of linkedIds) {
      const p = playersById.get(pid);
      if (p) {
        const playerFullName = `${p.firstName} ${p.lastName}`;
        if (currentName === p.firstName || currentName === playerFullName) {
          isPlayerName = true;
          break;
        }
      }
    }

    // Also check if current name just doesn't look like the parent name
    if (!isPlayerName && currentName) {
      // Only fix if we're confident it's wrong
      // Check all linked players to see if displayName matches any child
      for (const pid of linkedIds) {
        const p = playersById.get(pid);
        if (p && (currentName.includes(p.firstName) || currentName.includes(p.lastName))) {
          // Could be the parent shares the last name - only flag if first name matches a child
          if (currentName.split(' ')[0] === p.firstName) {
            isPlayerName = true;
            break;
          }
        }
      }
    }

    if (isPlayerName || !currentName) {
      console.log(`FIX: ${email} | "${currentName}" -> "${parentName}"`);
      await db.collection('users').doc(doc.id).update({
        displayName: parentName,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      fixCount++;
    } else {
      console.log(`SKIP: ${email} | current="${currentName}" parent="${parentName}" (names differ but current doesn't match a child)`);
    }
  }

  // Also check pendingUsers
  console.log('\n--- Pending Users ---');
  const pendingSnap = await db.collection('pendingUsers').get();
  let pendingFixCount = 0;
  for (const doc of pendingSnap.docs) {
    const data = doc.data();
    const email = (data.email || '').toLowerCase();
    const currentName = data.displayName || '';
    const parentName = emailToParentName.get(email);

    if (!parentName || currentName === parentName) continue;

    // Check linked players
    const linkedIds = data.linkedPlayerIds || [];
    let isPlayerName = false;
    for (const pid of linkedIds) {
      const p = playersById.get(pid);
      if (p) {
        if (currentName === p.firstName || currentName === `${p.firstName} ${p.lastName}`) {
          isPlayerName = true;
          break;
        }
      }
    }

    if (isPlayerName || !currentName) {
      console.log(`FIX PENDING: ${email} | "${currentName}" -> "${parentName}"`);
      await db.collection('pendingUsers').doc(doc.id).update({
        displayName: parentName,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      pendingFixCount++;
    }
  }

  console.log(`\nFixed ${fixCount} users, ${pendingFixCount} pending users`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
