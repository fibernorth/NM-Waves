// Update players with team assignments and create teams
// Uses the expanded Customer Contact List with Company (team) column
//
// Usage:
//   node scripts/import-teams-update.js --dry-run
//   node scripts/import-teams-update.js

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const firebaseConfig = {
  apiKey: "AIzaSyBudHBD7L6rEZCvHJ41QBAnA67Mb_mWIY0",
  authDomain: "tcw-website-builder.firebaseapp.com",
  projectId: "tcw-website-builder",
  storageBucket: "tcw-website-builder.firebasestorage.app",
  messagingSenderId: "110366167929",
  appId: "1:110366167929:web:f0d76d7eea8dee70e755a8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const authInstance = getAuth(app);

const SEASON = '2025-2026';
const IMPORTS_DIR = join(__dirname, '..', 'imports');

// Coach assignments
const COACHES = {
  '12U': { name: 'Yanska', lastName: 'Yanska' },
  '13U': { name: 'Olds', lastName: 'Olds' },
  '14U': { name: 'Gibel', lastName: 'Gibel' },
};

// Business names to skip
const BUSINESS_NAMES = new Set([
  'Craig Wealth Advisors', 'Eising Construction', 'FiberNorth, Inc.',
  'Kadlec Associates', 'Molon Excavating', 'Reichard and Hack',
  'Sample Customer', 'Stanley Steemer', 'TBA Credit Union',
  'Torch Riviera', 'Triston Cole Agency',
]);

// CSV parser
function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '""'; i++; }
      else { inQuotes = !inQuotes; current += ch; }
    } else if (ch === '\n' && !inQuotes) { lines.push(current); current = ''; }
    else if (ch === '\r' && !inQuotes) { /* skip */ }
    else { current += ch; }
  }
  if (current.trim()) lines.push(current);

  return lines.map(line => {
    const fields = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { field += '"'; i++; }
        else { inQ = !inQ; }
      } else if (ch === ',' && !inQ) { fields.push(field.trim()); field = ''; }
      else { field += ch; }
    }
    fields.push(field.trim());
    return fields;
  });
}

function parsePhone(str) {
  if (!str) return '';
  const match = str.match(/Phone:\s*([^\s]+(?:\s[^\s]+)?(?:\s[^\s]+)?)/);
  if (match) return match[1];
  const mobile = str.match(/Mobile:\s*([^\s]+(?:\s[^\s]+)?(?:\s[^\s]+)?)/);
  if (mobile) return mobile[1];
  return str;
}

function normalizeTeamKey(company) {
  if (!company) return null;
  const upper = company.toUpperCase();
  if (upper.includes('14U')) return '14U';
  if (upper.includes('13U')) return '13U';
  if (upper.includes('12U')) return '12U';
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('╔════════════════════════════════════════════╗');
  console.log('║   NM Waves - Teams & Player Update        ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  if (!dryRun) {
    const password = process.env.FB_PASSWORD;
    if (!password) { console.error('Set FB_PASSWORD env var'); process.exit(1); }
    await signInWithEmailAndPassword(authInstance, 'tcwavessoftball@gmail.com', password);
    console.log('Signed in!\n');
  }

  // Parse contact list
  const filePath = join(IMPORTS_DIR, 'Northern Michigan Waves Inc_Customer Contact List.csv');
  const text = readFileSync(filePath, 'utf-8');
  const rows = parseCSV(text);

  // Find header
  const headerIdx = rows.findIndex(r => r[0] === 'Customer full name');
  if (headerIdx === -1) { console.error('Could not find header row'); process.exit(1); }
  const headers = rows[headerIdx];
  console.log(`Columns: ${headers.length}`);

  // Column indexes
  const COL = {
    fullName: 0,
    phone: 1,
    email: 2,
    firstName: 18,
    lastName: 19,
    city: 8,
    street: 9,
    state: 10,
    zip: 11,
    company: 12,  // Team name
  };

  // Build team rosters
  const teamPlayers = { '12U': [], '13U': [], '14U': [] };
  const playerUpdates = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] || row[0].startsWith('"') || row[0].startsWith('Sunday')) continue;

    const fullName = row[COL.fullName];
    if (BUSINESS_NAMES.has(fullName)) continue;

    const teamKey = normalizeTeamKey(row[COL.company]);
    if (!teamKey) continue;

    const playerId = fullName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const firstName = row[COL.firstName]?.trim() || fullName.split(' ')[0];
    const lastName = row[COL.lastName]?.trim() || fullName.split(' ').slice(1).join(' ');

    teamPlayers[teamKey].push({
      playerId,
      firstName,
      lastName,
      fullName,
    });

    playerUpdates.push({
      playerId,
      firstName,
      lastName,
      phone: parsePhone(row[COL.phone]),
      email: row[COL.email]?.trim() || '',
      city: row[COL.city]?.trim() || '',
      street: row[COL.street]?.trim() || '',
      state: row[COL.state]?.trim() || '',
      zip: row[COL.zip]?.trim() || '',
      teamKey,
      teamName: `NM Waves ${SEASON.split('-')[1]} ${teamKey}`,
    });
  }

  // ─── Create Teams ────────────────────────────────────────
  console.log('\n━━━ Creating Teams ━━━');
  const teamIds = {};

  for (const [ageGroup, players] of Object.entries(teamPlayers)) {
    const teamId = `nm-waves-2026-${ageGroup.toLowerCase()}`;
    const teamName = `NM Waves 2026 ${ageGroup}`;
    const coach = COACHES[ageGroup];
    const playerIds = players.map(p => p.playerId);

    const teamData = {
      name: teamName,
      ageGroup,
      season: SEASON,
      coachIds: [],
      playerIds,
      coachName: coach.name,
      active: true,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    teamIds[ageGroup] = teamId;

    if (dryRun) {
      console.log(`  [DRY RUN] Team: ${teamName} (Coach: ${coach.name}, ${players.length} players)`);
      players.forEach(p => console.log(`    - ${p.firstName} ${p.lastName}`));
    } else {
      await setDoc(doc(db, 'teams', teamId), teamData);
      console.log(`  Created: ${teamName} (Coach: ${coach.name}, ${players.length} players)`);
    }
  }

  // ─── Update Players ──────────────────────────────────────
  console.log('\n━━━ Updating Players ━━━');

  for (const p of playerUpdates) {
    const teamId = teamIds[p.teamKey];
    const teamName = p.teamName;

    const updateData = {
      firstName: p.firstName,
      lastName: p.lastName,
      teamId,
      teamName,
      parentEmail: p.email,
      parentPhone: p.phone,
      contacts: [{
        name: `${p.firstName} ${p.lastName}`,
        relationship: 'self',
        email: p.email,
        phone: p.phone,
      }],
      updatedAt: new Date(),
    };

    if (dryRun) {
      console.log(`  [DRY RUN] ${p.firstName} ${p.lastName} → ${teamName}`);
    } else {
      await setDoc(doc(db, 'players', p.playerId), updateData, { merge: true });
      console.log(`  Updated: ${p.firstName} ${p.lastName} → ${teamName}`);
    }
  }

  // ─── Update Player Finances with Team ────────────────────
  console.log('\n━━━ Updating Player Finances with Teams ━━━');

  for (const p of playerUpdates) {
    const teamId = teamIds[p.teamKey];
    const teamName = p.teamName;
    const financeId = `${p.playerId}-${SEASON}`;

    if (dryRun) {
      console.log(`  [DRY RUN] Finance ${p.firstName} ${p.lastName} → ${teamName}`);
    } else {
      try {
        await updateDoc(doc(db, 'playerFinances', financeId), {
          teamId,
          teamName,
          updatedAt: new Date(),
        });
        console.log(`  Updated finance: ${p.firstName} ${p.lastName} → ${teamName}`);
      } catch (e) {
        console.log(`  Skipped finance (no record): ${p.firstName} ${p.lastName}`);
      }
    }
  }

  console.log('\n════════════════════════════════════════════');
  console.log(`Teams: ${Object.keys(teamPlayers).length} created`);
  console.log(`Players: ${playerUpdates.length} updated`);
  console.log(dryRun ? 'Dry run complete.' : 'Update complete!');

  process.exit(0);
}

main();
