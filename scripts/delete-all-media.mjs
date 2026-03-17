#!/usr/bin/env node
/**
 * Delete ALL media from Firestore + Firebase Storage.
 * Removes every doc in the `media` collection and their corresponding
 * files (main + thumbnail) from Storage.
 *
 * Usage: node scripts/delete-all-media.mjs
 *
 * Pass --yes to skip the confirmation prompt.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import readline from 'readline';

// --- Config ---
const BUCKET_NAME = 'tcw-website-builder.firebasestorage.app';
const BATCH_SIZE = 500; // Firestore batch limit

// --- Init Firebase Admin ---
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'serviceAccountKey.json';
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({
  credential: cert(serviceAccount),
  projectId: 'tcw-website-builder',
  storageBucket: BUCKET_NAME,
});

const db = getFirestore();
const bucket = getStorage().bucket();

/**
 * Extract the Storage file path from a Firebase Storage download URL.
 * URL format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/ENCODED_PATH?alt=media
 */
function storagePathFromUrl(url) {
  if (!url) return null;
  try {
    const match = url.match(/\/o\/([^?]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  } catch {}
  return null;
}

async function confirm(message) {
  if (process.argv.includes('--yes')) return true;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`${message} (yes/no): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

// --- Main ---
console.log('Media Mass Delete Tool');
console.log('======================\n');

// Count docs first
const countSnap = await db.collection('media').count().get();
const totalDocs = countSnap.data().count;

if (totalDocs === 0) {
  console.log('No media documents found. Nothing to delete.');
  process.exit(0);
}

console.log(`Found ${totalDocs} media documents to delete.`);
console.log('This will delete ALL Firestore media docs AND their Storage files (main + thumbnail).\n');

const ok = await confirm('Are you sure you want to delete everything?');
if (!ok) {
  console.log('Aborted.');
  process.exit(0);
}

console.log('\nStarting deletion...\n');

let deletedDocs = 0;
let deletedFiles = 0;
let failedFiles = 0;

// Process in batches
let lastDoc = null;

while (true) {
  let query = db.collection('media').orderBy('__name__').limit(BATCH_SIZE);
  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }

  const snap = await query.get();
  if (snap.empty) break;

  // Collect storage paths to delete
  const storagePaths = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const mainPath = storagePathFromUrl(data.fileUrl);
    const thumbPath = storagePathFromUrl(data.thumbnailUrl);
    if (mainPath) storagePaths.push(mainPath);
    if (thumbPath) storagePaths.push(thumbPath);
  }

  // Delete storage files (in parallel, batches of 20)
  for (let i = 0; i < storagePaths.length; i += 20) {
    const chunk = storagePaths.slice(i, i + 20);
    const results = await Promise.allSettled(
      chunk.map(p => bucket.file(p).delete().catch(() => null))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') deletedFiles++;
      else failedFiles++;
    }
  }

  // Delete Firestore docs in a batch
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  deletedDocs += snap.docs.length;

  lastDoc = snap.docs[snap.docs.length - 1];
  console.log(`  Deleted ${deletedDocs}/${totalDocs} docs, ${deletedFiles} storage files...`);
}

// Also delete any remaining files under media/ and media/thumbs/ prefixes
// in case there are orphaned files not referenced by docs
console.log('\nCleaning up any orphaned storage files under media/...');
try {
  const [files] = await bucket.getFiles({ prefix: 'media/' });
  if (files.length > 0) {
    console.log(`  Found ${files.length} files under media/ prefix.`);
    for (let i = 0; i < files.length; i += 20) {
      const chunk = files.slice(i, i + 20);
      await Promise.allSettled(chunk.map(f => f.delete().catch(() => null)));
    }
    console.log(`  Cleaned up orphaned storage files.`);
  } else {
    console.log('  No orphaned files found.');
  }
} catch (err) {
  console.error('  Error cleaning orphaned files:', err.message);
}

console.log('\n======================');
console.log('Done!');
console.log(`  Firestore docs deleted: ${deletedDocs}`);
console.log(`  Storage files deleted: ${deletedFiles}`);
if (failedFiles > 0) {
  console.log(`  Storage file delete failures: ${failedFiles} (may already have been deleted)`);
}
