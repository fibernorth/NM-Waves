// Import 2025 Tryout Registration CSV for 13U
// Merges data onto existing players when matched by name,
// creates tryout-applicant records for unmatched players.
//
// Usage:
//   node scripts/import-tryout-2025-13u.js --dry-run
//   node scripts/import-tryout-2025-13u.js

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
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

// CSV parser (handles quoted fields with commas)
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

// Normalize a name for matching
function normName(str) {
  return (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Parse positions from CSV field (e.g., "3rd, 2nd, catcher some outfield")
function parsePositions(str) {
  if (!str) return [];
  const posMap = {
    'pitcher': 'Pitcher',
    'catcher': 'Catcher',
    '1st': 'First Base',
    'first': 'First Base',
    'first base': 'First Base',
    '2nd': 'Second Base',
    'second': 'Second Base',
    'second base': 'Second Base',
    'ss': 'Shortstop',
    'shortstop': 'Shortstop',
    'short stop': 'Shortstop',
    '3rd': 'Third Base',
    'third': 'Third Base',
    'third base': 'Third Base',
    'left': 'Left Field',
    'left field': 'Left Field',
    'center': 'Center Field',
    'center field': 'Center Field',
    'right': 'Right Field',
    'right field': 'Right Field',
    'outfield': 'Outfield',
    'utility': 'Utility',
  };

  const lower = str.toLowerCase();
  const positions = [];
  for (const [key, val] of Object.entries(posMap)) {
    if (lower.includes(key) && !positions.includes(val)) {
      positions.push(val);
    }
  }
  return positions;
}

// Parse date string (M/D/YYYY format)
function parseDate(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [month, day, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('╔════════════════════════════════════════════╗');
  console.log('║   TC Waves - 2025 Tryout Import (13U)      ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  // Auth
  if (!dryRun) {
    const password = process.env.FB_PASSWORD;
    if (!password) {
      console.error('Set FB_PASSWORD env var');
      process.exit(1);
    }
    await signInWithEmailAndPassword(authInstance, 'tcwavessoftball@gmail.com', password);
    console.log('Signed in!\n');
  }

  // Read CSV
  const csvPath = join(__dirname, '..', 'TC Waves Tryout Registration 2025 (Responses) - 13U.csv');
  let text;
  try {
    text = readFileSync(csvPath, 'utf-8');
  } catch {
    // Try Downloads folder
    const altPath = 'C:/Users/bill/Downloads/TC Waves Tryout Registration 2025 (Responses) - 13U.csv';
    text = readFileSync(altPath, 'utf-8');
  }
  const rows = parseCSV(text);

  // Header row
  // Timestamp, First Name, Last Name, Birthdate, Address, School,
  // Position(s), Years of travel ball experience, Name (First and Last),
  // Phone number, Email address, Financial party
  const header = rows[0];
  console.log(`CSV columns: ${header.join(' | ')}`);
  console.log(`CSV data rows: ${rows.length - 1}\n`);

  // Column indexes
  const COL = {
    timestamp: 0,
    firstName: 1,
    lastName: 2,
    birthdate: 3,
    address: 4,
    school: 5,
    positions: 6,
    yearsExperience: 7,
    parentName: 8,
    parentPhone: 9,
    parentEmail: 10,
    financialParty: 11,
  };

  // Parse CSV rows into tryout records
  const tryouts = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[COL.firstName]) continue;

    tryouts.push({
      firstName: r[COL.firstName].trim(),
      lastName: r[COL.lastName].trim(),
      birthdate: r[COL.birthdate]?.trim(),
      dateOfBirth: parseDate(r[COL.birthdate]?.trim()),
      address: r[COL.address]?.trim(),
      school: r[COL.school]?.trim(),
      positions: parsePositions(r[COL.positions]),
      positionsRaw: r[COL.positions]?.trim(),
      yearsExperience: r[COL.yearsExperience]?.trim(),
      parentName: r[COL.parentName]?.trim(),
      parentPhone: r[COL.parentPhone]?.trim(),
      parentEmail: r[COL.parentEmail]?.trim(),
      financialParty: r[COL.financialParty]?.trim(),
      registeredAt: r[COL.timestamp]?.trim(),
    });
  }

  console.log(`Parsed ${tryouts.length} tryout registrations\n`);

  // Fetch existing players from Firestore
  let existingPlayers = [];
  if (!dryRun) {
    const q = query(collection(db, 'players'), orderBy('lastName'));
    const snap = await getDocs(q);
    existingPlayers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`Found ${existingPlayers.length} existing players in Firestore\n`);
  } else {
    console.log('[DRY RUN] Skipping Firestore read\n');
  }

  // Match tryout registrations against existing players
  const matched = [];
  const unmatched = [];

  for (const tryout of tryouts) {
    const tryoutFirst = normName(tryout.firstName);
    const tryoutLast = normName(tryout.lastName);

    const match = existingPlayers.find(p => {
      const pFirst = normName(p.firstName);
      const pLast = normName(p.lastName);
      return pFirst === tryoutFirst && pLast === tryoutLast;
    });

    if (match) {
      matched.push({ tryout, player: match });
    } else {
      unmatched.push(tryout);
    }
  }

  console.log(`━━━ Match Results ━━━`);
  console.log(`  Matched to existing players: ${matched.length}`);
  console.log(`  New (unmatched): ${unmatched.length}\n`);

  // ─── Update matched players with tryout data ──────────────
  console.log('━━━ Updating Matched Players ━━━');
  for (const { tryout, player } of matched) {
    const updates = {};

    // Merge DOB if player doesn't have one
    if (tryout.dateOfBirth && !player.dateOfBirth) {
      updates.dateOfBirth = Timestamp.fromDate(tryout.dateOfBirth);
    }

    // Merge positions - combine existing with tryout positions
    const existingPositions = player.positions || [];
    const newPositions = tryout.positions.filter(p => !existingPositions.includes(p));
    if (newPositions.length > 0) {
      updates.positions = [...existingPositions, ...newPositions];
    }

    // Update parent contact info if missing
    if (tryout.parentName && !player.parentName) {
      updates.parentName = tryout.parentName;
    }
    if (tryout.parentEmail && !player.parentEmail) {
      updates.parentEmail = tryout.parentEmail;
    }
    if (tryout.parentPhone && !player.parentPhone) {
      updates.parentPhone = tryout.parentPhone;
    }

    // Add a contact entry for the parent from tryout data
    const existingContacts = player.contacts || [];
    const parentAlreadyExists = existingContacts.some(
      c => normName(c.name) === normName(tryout.parentName) ||
           (c.email && c.email.toLowerCase() === (tryout.parentEmail || '').toLowerCase())
    );
    if (tryout.parentName && !parentAlreadyExists) {
      updates.contacts = [
        ...existingContacts,
        {
          name: tryout.parentName,
          relationship: 'parent',
          email: tryout.parentEmail || '',
          phone: tryout.parentPhone || '',
        },
      ];
    }

    // Add school, address, experience as notes if not already present
    const notesParts = [];
    if (tryout.school) notesParts.push(`School: ${tryout.school}`);
    if (tryout.address) notesParts.push(`Address: ${tryout.address}`);
    if (tryout.yearsExperience) notesParts.push(`Travel ball experience: ${tryout.yearsExperience} yrs`);
    if (tryout.financialParty) notesParts.push(`Financial party: ${tryout.financialParty}`);

    if (notesParts.length > 0) {
      const tryoutNote = `[2025 Tryout] ${notesParts.join(' | ')}`;
      const existingNotes = player.notes || '';
      if (!existingNotes.includes('2025 Tryout')) {
        updates.notes = existingNotes
          ? `${existingNotes}\n${tryoutNote}`
          : tryoutNote;
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = Timestamp.now();

      if (dryRun) {
        console.log(`  [DRY RUN] ${tryout.firstName} ${tryout.lastName} (${player.id})`);
        console.log(`    Updates: ${Object.keys(updates).filter(k => k !== 'updatedAt').join(', ')}`);
      } else {
        await updateDoc(doc(db, 'players', player.id), updates);
        console.log(`  Updated: ${tryout.firstName} ${tryout.lastName} (${player.id})`);
        console.log(`    Fields: ${Object.keys(updates).filter(k => k !== 'updatedAt').join(', ')}`);
      }
    } else {
      console.log(`  No updates needed: ${tryout.firstName} ${tryout.lastName}`);
    }
  }

  // ─── Create tryout-applicant records for unmatched ────────
  console.log('\n━━━ Creating Tryout Applicant Records ━━━');
  for (const tryout of unmatched) {
    const applicantData = {
      playerFirstName: tryout.firstName,
      playerLastName: tryout.lastName,
      dateOfBirth: tryout.birthdate || '',
      ageGroup: '13U',
      parentName: tryout.parentName || '',
      email: tryout.parentEmail || '',
      phone: tryout.parentPhone || '',
      positionsInterested: tryout.positionsRaw || tryout.positions.join(', '),
      priorExperience: tryout.yearsExperience
        ? `${tryout.yearsExperience} years of travel ball`
        : '',
      address: tryout.address || '',
      school: tryout.school || '',
      financialParty: tryout.financialParty || '',
      submittedAt: Timestamp.now(),
      importedFrom: '2025 Google Form CSV',
      status: 'new',
      season: '2025',
    };

    if (dryRun) {
      console.log(`  [DRY RUN] New applicant: ${tryout.firstName} ${tryout.lastName}`);
      console.log(`    DOB: ${tryout.birthdate}, School: ${tryout.school}`);
      console.log(`    Parent: ${tryout.parentName} (${tryout.parentEmail})`);
    } else {
      const docRef = await addDoc(collection(db, 'tryout-applicants'), applicantData);
      console.log(`  Created: ${tryout.firstName} ${tryout.lastName} (${docRef.id})`);
    }
  }

  // ─── Summary ──────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════');
  console.log(`Players updated: ${matched.length}`);
  console.log(`Tryout applicants created: ${unmatched.length}`);
  console.log(dryRun ? 'Dry run complete.' : 'Import complete!');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
