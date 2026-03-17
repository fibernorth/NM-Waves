#!/usr/bin/env node
/**
 * Import Google Photos Takeout ZIP files into Firebase Storage + Firestore.
 *
 * Reads Takeout ZIPs from a local folder, extracts images with their
 * companion JSON metadata sidecars, and creates media docs preserving
 * original photo dates and album folder names as tags.
 *
 * Usage:
 *   node scripts/process-takeout.mjs "C:\Users\bill\Downloads\takeout"
 *
 * The folder should contain one or more Takeout .zip files.
 *
 * Requires: serviceAccountKey.json in project root (or GOOGLE_APPLICATION_CREDENTIALS env var)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readFileSync } from 'fs';

// Dynamic imports for ESM packages
const unzipper = await import('unzipper');
const sharp = (await import('sharp')).default;

// --- Config ---
const BUCKET_NAME = 'tcw-website-builder.firebasestorage.app';
const MAX_DIMENSION = 1920;
const THUMB_DIMENSION = 400;
const QUALITY = 85;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif']);

// --- Init Firebase Admin ---
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'serviceAccountKey.json';
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: 'tcw-website-builder',
  storageBucket: BUCKET_NAME,
});

const db = getFirestore();
const bucket = getStorage().bucket();

// Cache of known fileNames in Firestore to avoid repeated queries
const knownFileNames = new Set();

// --- Helpers ---
function isImage(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Extract the album/folder name from a Takeout ZIP entry path.
 * Takeout structure: Takeout/Google Photos/<Album Name>/image.jpg
 * Returns the album folder name, or null if not found.
 */
function extractAlbumName(entryPath) {
  // Normalize separators
  const parts = entryPath.replace(/\\/g, '/').split('/');
  // Find "Google Photos" segment, album name is the next part
  const gpIdx = parts.indexOf('Google Photos');
  if (gpIdx >= 0 && gpIdx + 2 < parts.length) {
    return parts[gpIdx + 1];
  }
  // Fallback: if path has at least a parent folder and a filename, use the parent
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return null;
}

/**
 * Try to find and parse the JSON metadata sidecar for a given image entry.
 * Checks multiple naming conventions Google Takeout uses.
 * Works for both ZIP entries (using jsonFileMap) and extracted files (using disk).
 */
function findMetadataJson(imageEntryPath, jsonFileMap) {
  const normalized = imageEntryPath.replace(/\\/g, '/');

  // 1. Exact: image.jpg.json
  const candidate1 = normalized + '.json';
  if (jsonFileMap.has(candidate1)) {
    return jsonFileMap.get(candidate1);
  }

  // 2. Supplemental metadata: image.jpg.supplemental-metadata.json
  const candidate2 = normalized + '.supplemental-metadata.json';
  if (jsonFileMap.has(candidate2)) {
    return jsonFileMap.get(candidate2);
  }

  // 3. Shortened supplemental: image.jpg.sup.json
  const candidate3 = normalized + '.sup.json';
  if (jsonFileMap.has(candidate3)) {
    return jsonFileMap.get(candidate3);
  }

  // 4. Google sometimes truncates long filenames in the JSON sidecar name.
  //    For filenames > 46 chars, the .json sidecar may use a truncated name.
  //    Try matching by looking at nearby JSON files in the same folder and
  //    checking their "title" field against our filename.
  const imageDir = normalized.substring(0, normalized.lastIndexOf('/') + 1);
  const imageFileName = path.basename(normalized);

  for (const [jsonPath, jsonData] of jsonFileMap.entries()) {
    if (!jsonPath.startsWith(imageDir)) continue;
    if (jsonData && jsonData.title === imageFileName) {
      return jsonData;
    }
  }

  return null;
}

/**
 * Find JSON metadata sidecar for an image on disk (extracted folder mode).
 */
function findMetadataJsonOnDisk(imagePath) {
  const candidates = [
    imagePath + '.json',
    imagePath + '.supplemental-metadata.json',
    imagePath + '.sup.json',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        return JSON.parse(readFileSync(candidate, 'utf8'));
      } catch {}
    }
  }

  // Fallback: check all JSON files in the same folder for title match
  const dir = path.dirname(imagePath);
  const imageFileName = path.basename(imagePath);
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const data = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
        if (data.title === imageFileName) return data;
      } catch {}
    }
  } catch {}

  return null;
}

async function resizeAndUpload(localPath, originalName, subfolder) {
  const ext = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, ext);
  const sanitized = sanitizeFilename(baseName);
  const timestamp = Date.now();
  const storagePath = `media/${subfolder}/${timestamp}_${sanitized}${ext}`;
  const thumbPath = `media/thumbs/${subfolder}/${timestamp}_${sanitized}${ext}`;

  try {
    const metadata = await sharp(localPath).metadata();
    const { width, height } = metadata;

    // Resize main image if needed
    let mainBuffer;
    if ((width && width > MAX_DIMENSION) || (height && height > MAX_DIMENSION)) {
      mainBuffer = await sharp(localPath)
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: QUALITY })
        .toBuffer();
    } else {
      mainBuffer = fs.readFileSync(localPath);
    }

    // Generate thumbnail
    const thumbBuffer = await sharp(localPath)
      .resize(THUMB_DIMENSION, THUMB_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    // Upload main image
    const mainFile = bucket.file(storagePath);
    await mainFile.save(mainBuffer, {
      metadata: {
        contentType: ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg',
      },
    });
    const mainUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(storagePath)}?alt=media`;

    // Upload thumbnail
    const thumbFile = bucket.file(thumbPath);
    await thumbFile.save(thumbBuffer, {
      metadata: { contentType: 'image/jpeg' },
    });
    const thumbUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(thumbPath)}?alt=media`;

    return { mainUrl, thumbUrl, size: mainBuffer.length };
  } catch (err) {
    console.error(`  Error processing ${originalName}:`, err.message);
    return null;
  }
}

/**
 * Check if a file with this name already exists in Firestore media collection.
 * Uses a local cache to minimize queries.
 */
async function isDuplicate(fileName) {
  if (knownFileNames.has(fileName)) return true;

  const snap = await db.collection('media')
    .where('fileName', '==', fileName)
    .limit(1)
    .get();

  if (!snap.empty) {
    knownFileNames.add(fileName);
    return true;
  }
  return false;
}

/**
 * Pre-load all existing fileNames from Firestore to speed up duplicate checking.
 */
async function preloadExistingFileNames() {
  console.log('Loading existing media filenames from Firestore...');
  const snap = await db.collection('media').select('fileName').get();
  snap.forEach(doc => {
    const name = doc.data().fileName;
    if (name) knownFileNames.add(name);
  });
  console.log(`  Found ${knownFileNames.size} existing media docs.`);
}

function buildTags(albumName, photoDate) {
  const tags = [];

  // Add album name as tag (skip generic "Photos from YYYY" folders)
  if (albumName) {
    tags.push(albumName);
  }

  // Add year tag from photo date
  if (photoDate) {
    const year = new Date(photoDate * 1000).getFullYear().toString();
    if (!tags.includes(year)) {
      tags.push(year);
    }
  }

  return tags;
}

async function createMediaDoc(fileName, mainUrl, thumbUrl, fileSize, tags, photoTimestamp, description) {
  const photoDate = photoTimestamp
    ? Timestamp.fromDate(new Date(photoTimestamp * 1000))
    : null;

  const doc = {
    fileName,
    fileUrl: mainUrl,
    thumbnailUrl: thumbUrl,
    fileSize,
    mediaType: 'image',
    teamId: 'all',
    tags,
    uploadedBy: 'admin-import',
    uploadedByName: 'Google Photos Import',
    moderationStatus: 'approved',
    source: 'google_photos',
    createdAt: photoDate || Timestamp.now(),
  };

  if (photoDate) {
    doc.photoDate = photoDate;
  }

  if (description) {
    doc.caption = description;
  }

  const ref = await db.collection('media').add(doc);
  return ref.id;
}

// --- Main ---
async function processZipFile(zipPath) {
  const zipName = path.basename(zipPath);
  console.log(`\n========================================`);
  console.log(`Processing: ${zipName}`);
  console.log(`========================================`);

  const tempDir = path.join(os.tmpdir(), `takeout-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  let directory;
  try {
    directory = await unzipper.Open.file(zipPath);
  } catch (err) {
    console.error(`  Failed to open ZIP: ${err.message}`);
    return { processed: 0, skipped: 0, duplicates: 0, failed: 0 };
  }

  const totalFiles = directory.files.length;

  // Separate image files and JSON files
  const imageFiles = [];
  const jsonFileMap = new Map(); // path -> parsed JSON data

  console.log(`  Scanning ${totalFiles} entries...`);

  for (const entry of directory.files) {
    const entryPath = entry.path.replace(/\\/g, '/');

    // Skip macOS metadata and hidden files
    if (entryPath.includes('__MACOSX') || path.basename(entryPath).startsWith('.')) {
      continue;
    }

    if (entryPath.endsWith('.json')) {
      // Pre-parse JSON metadata files
      try {
        const buf = await entry.buffer();
        const data = JSON.parse(buf.toString('utf8'));
        jsonFileMap.set(entryPath, data);
      } catch {
        // Not valid JSON or can't read — skip
      }
    } else if (isImage(entryPath)) {
      imageFiles.push(entry);
    }
  }

  console.log(`  Found ${imageFiles.length} images, ${jsonFileMap.size} JSON metadata files`);

  let processed = 0;
  let skipped = 0;
  let duplicates = 0;
  let failed = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const entry = imageFiles[i];
    const entryPath = entry.path.replace(/\\/g, '/');
    const fileName = path.basename(entryPath);

    if (!fileName || fileName.startsWith('.')) {
      skipped++;
      continue;
    }

    // Duplicate check
    if (knownFileNames.has(fileName) || await isDuplicate(fileName)) {
      duplicates++;
      if (duplicates % 50 === 0) {
        console.log(`  Skipped ${duplicates} duplicates so far...`);
      }
      continue;
    }

    // Find JSON metadata sidecar
    const meta = findMetadataJson(entryPath, jsonFileMap);
    const photoTimestamp = meta?.photoTakenTime?.timestamp
      ? parseInt(meta.photoTakenTime.timestamp, 10)
      : null;
    const description = meta?.description || null;

    // Extract album name and build tags
    const albumName = extractAlbumName(entryPath);
    const tags = buildTags(albumName, photoTimestamp);

    // Use album name (sanitized) as storage subfolder
    const subfolder = sanitizeFilename(albumName || 'takeout');

    const tempImagePath = path.join(tempDir, `img_${i}_${sanitizeFilename(fileName)}`);

    try {
      // Extract image to temp file
      const content = await entry.buffer();
      fs.writeFileSync(tempImagePath, content);

      // Resize and upload
      const result = await resizeAndUpload(tempImagePath, fileName, subfolder);

      if (result) {
        await createMediaDoc(fileName, result.mainUrl, result.thumbUrl, result.size, tags, photoTimestamp, description);
        knownFileNames.add(fileName);
        processed++;

        if (processed % 10 === 0) {
          console.log(`  Progress: ${processed}/${imageFiles.length} images processed (${duplicates} duplicates skipped)`);
        }
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`  Failed on ${fileName}:`, err.message);
      failed++;
    } finally {
      try { fs.unlinkSync(tempImagePath); } catch {}
    }
  }

  // Clean up temp dir
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

  console.log(`\nResults for ${zipName}:`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Duplicates skipped: ${duplicates}`);
  console.log(`  Skipped (other): ${skipped}`);
  console.log(`  Failed: ${failed}`);

  return { processed, skipped, duplicates, failed };
}

/**
 * Recursively collect all files in a directory.
 */
function walkDir(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Process an already-extracted Takeout folder (not a ZIP).
 * Walks the directory tree, finds images + JSON sidecars on disk.
 */
async function processExtractedFolder(folderPath) {
  console.log(`\n========================================`);
  console.log(`Processing extracted folder: ${folderPath}`);
  console.log(`========================================`);

  console.log(`  Scanning files...`);
  const allFiles = walkDir(folderPath);
  const imageFiles = allFiles.filter(f => {
    const base = path.basename(f);
    return !base.startsWith('.') && isImage(f);
  });

  console.log(`  Found ${allFiles.length} total files, ${imageFiles.length} images`);

  let processed = 0;
  let skipped = 0;
  let duplicates = 0;
  let failed = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const filePath = imageFiles[i];
    const fileName = path.basename(filePath);

    if (!fileName || fileName.startsWith('.')) {
      skipped++;
      continue;
    }

    // Duplicate check
    if (knownFileNames.has(fileName) || await isDuplicate(fileName)) {
      duplicates++;
      if (duplicates % 50 === 0) {
        console.log(`  Skipped ${duplicates} duplicates so far...`);
      }
      continue;
    }

    // Find JSON metadata sidecar on disk
    const meta = findMetadataJsonOnDisk(filePath);
    const photoTimestamp = meta?.photoTakenTime?.timestamp
      ? parseInt(meta.photoTakenTime.timestamp, 10)
      : null;
    const description = meta?.description || null;

    // Extract album name from path
    // The path includes the Google Photos folder structure
    const relativePath = filePath.replace(/\\/g, '/');
    const albumName = extractAlbumName(relativePath);
    const tags = buildTags(albumName, photoTimestamp);

    // Use album name (sanitized) as storage subfolder
    const subfolder = sanitizeFilename(albumName || 'takeout');

    try {
      // Resize and upload directly from disk (no temp file needed)
      const result = await resizeAndUpload(filePath, fileName, subfolder);

      if (result) {
        await createMediaDoc(fileName, result.mainUrl, result.thumbUrl, result.size, tags, photoTimestamp, description);
        knownFileNames.add(fileName);
        processed++;

        if (processed % 10 === 0) {
          console.log(`  Progress: ${processed}/${imageFiles.length} images processed (${duplicates} duplicates skipped)`);
        }
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`  Failed on ${fileName}:`, err.message);
      failed++;
    }
  }

  console.log(`\nResults for extracted folder:`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Duplicates skipped: ${duplicates}`);
  console.log(`  Skipped (other): ${skipped}`);
  console.log(`  Failed: ${failed}`);

  return { processed, skipped, duplicates, failed };
}

// --- Entry point ---
const takeoutPath = process.argv[2];

if (!takeoutPath) {
  console.error('Usage: node scripts/process-takeout.mjs <path>');
  console.error('  Path can be a folder of Takeout .zip files, or an extracted Google Photos folder.');
  process.exit(1);
}

if (!fs.existsSync(takeoutPath)) {
  console.error(`Path not found: ${takeoutPath}`);
  process.exit(1);
}

console.log('Google Photos Takeout Importer');
console.log('==============================\n');
console.log(`Images will be resized to max ${MAX_DIMENSION}px with ${THUMB_DIMENSION}px thumbnails`);
console.log(`Storage bucket: ${BUCKET_NAME}\n`);

// Pre-load existing filenames for fast duplicate detection
await preloadExistingFileNames();

let totalProcessed = 0;
let totalDuplicates = 0;
let totalSkipped = 0;
let totalFailed = 0;

// Detect mode: ZIP files in folder, or extracted folder
const stat = fs.statSync(takeoutPath);
const zipFiles = stat.isDirectory()
  ? fs.readdirSync(takeoutPath).filter(f => f.toLowerCase().endsWith('.zip')).map(f => path.join(takeoutPath, f)).sort()
  : [];

if (zipFiles.length > 0) {
  // ZIP mode
  console.log(`Found ${zipFiles.length} ZIP file(s):`);
  zipFiles.forEach(z => console.log(`  - ${path.basename(z)}`));

  for (const zipFile of zipFiles) {
    try {
      const result = await processZipFile(zipFile);
      totalProcessed += result.processed;
      totalDuplicates += result.duplicates;
      totalSkipped += result.skipped;
      totalFailed += result.failed;
    } catch (err) {
      console.error(`\nFATAL error processing ${path.basename(zipFile)}:`, err);
    }
  }
} else if (stat.isDirectory()) {
  // Extracted folder mode
  console.log(`Processing extracted Takeout folder: ${takeoutPath}\n`);
  try {
    const result = await processExtractedFolder(takeoutPath);
    totalProcessed += result.processed;
    totalDuplicates += result.duplicates;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
  } catch (err) {
    console.error(`\nFATAL error processing folder:`, err);
  }
} else {
  console.error('Path must be a directory (containing ZIPs or extracted Takeout photos).');
  process.exit(1);
}

console.log('\n==============================');
console.log('All done!');
console.log(`  Total processed: ${totalProcessed}`);
console.log(`  Total duplicates skipped: ${totalDuplicates}`);
console.log(`  Total skipped (other): ${totalSkipped}`);
console.log(`  Total failed: ${totalFailed}`);
