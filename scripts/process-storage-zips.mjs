#!/usr/bin/env node
/**
 * Process zip files already in Firebase Storage.
 * Downloads each zip, extracts images, resizes them,
 * uploads to media/ in Storage, and creates Firestore media docs.
 *
 * Usage: node scripts/process-storage-zips.mjs
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a
 * service account key, OR run after `gcloud auth application-default login`,
 * OR it will use the Firebase Admin default credentials.
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';

// Dynamic imports for ESM packages
const unzipper = await import('unzipper');
const sharp = (await import('sharp')).default;

// --- Config ---
const BUCKET_NAME = 'tcw-website-builder.firebasestorage.app';
const ZIP_FILES = [
  'drive-download-20260216T001214Z-1-001.zip',
  'drive-download-20260216T001214Z-1-002.zip',
];
const MAX_DIMENSION = 1920;
const THUMB_DIMENSION = 400;
const QUALITY = 85;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif']);

// --- Init Firebase Admin ---
import { readFileSync } from 'fs';
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'serviceAccountKey.json';
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: 'tcw-website-builder',
  storageBucket: BUCKET_NAME,
});

const db = getFirestore();
const bucket = getStorage().bucket();

// --- Helpers ---
function isImage(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function resizeAndUpload(localPath, originalName, subfolder) {
  const ext = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, ext);
  const sanitized = sanitizeFilename(baseName);
  const timestamp = Date.now();
  const storagePath = `media/${subfolder}/${timestamp}_${sanitized}${ext}`;
  const thumbPath = `media/thumbs/${subfolder}/${timestamp}_${sanitized}${ext}`;

  try {
    // Get image metadata
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

async function createMediaDoc(fileName, mainUrl, thumbUrl, fileSize, subfolder) {
  const doc = {
    fileName,
    fileUrl: mainUrl,
    thumbnailUrl: thumbUrl,
    fileSize,
    mediaType: 'image',
    tags: [subfolder, 'legacy'],
    uploadedBy: 'admin-import',
    uploadedByName: 'Admin Import',
    moderationStatus: 'approved',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const ref = await db.collection('media').add(doc);
  return ref.id;
}

// --- Main ---
async function processZipFile(zipName) {
  console.log(`\n========================================`);
  console.log(`Processing: ${zipName}`);
  console.log(`========================================`);

  const tempDir = path.join(os.tmpdir(), `tcw-zip-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const localZipPath = path.join(tempDir, zipName);

  // Download zip from Storage
  console.log(`Downloading ${zipName} from Storage...`);
  const file = bucket.file(zipName);

  const [exists] = await file.exists();
  if (!exists) {
    console.error(`File ${zipName} not found in Storage!`);
    return;
  }

  const [metadata] = await file.getMetadata();
  const sizeGB = (parseInt(metadata.size) / (1024 * 1024 * 1024)).toFixed(2);
  console.log(`File size: ${sizeGB} GB`);

  await pipeline(
    file.createReadStream(),
    createWriteStream(localZipPath)
  );
  console.log(`Download complete.`);

  // Extract and process
  console.log(`Extracting images...`);

  // Derive a subfolder name from the zip
  const subfolder = zipName.replace('.zip', '').replace(/[^a-zA-Z0-9]/g, '_');

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  const directory = await unzipper.Open.file(localZipPath);
  const totalFiles = directory.files.length;
  const imageFiles = directory.files.filter(f => !f.path.startsWith('__MACOSX') && !f.path.startsWith('.') && isImage(f.path));

  console.log(`Found ${totalFiles} total entries, ${imageFiles.length} images`);

  for (let i = 0; i < imageFiles.length; i++) {
    const entry = imageFiles[i];
    const fileName = path.basename(entry.path);

    if (!fileName || fileName.startsWith('.')) {
      skipped++;
      continue;
    }

    const tempImagePath = path.join(tempDir, `img_${i}_${sanitizeFilename(fileName)}`);

    try {
      // Extract to temp file
      const content = await entry.buffer();
      fs.writeFileSync(tempImagePath, content);

      // Resize and upload
      const result = await resizeAndUpload(tempImagePath, fileName, subfolder);

      if (result) {
        await createMediaDoc(fileName, result.mainUrl, result.thumbUrl, result.size, subfolder);
        processed++;

        if (processed % 10 === 0 || processed === imageFiles.length) {
          console.log(`  Progress: ${processed}/${imageFiles.length} images processed`);
        }
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`  Failed on ${fileName}:`, err.message);
      failed++;
    } finally {
      // Clean up temp image
      try { fs.unlinkSync(tempImagePath); } catch {}
    }
  }

  // Clean up
  try { fs.unlinkSync(localZipPath); } catch {}
  try { fs.rmdirSync(tempDir, { recursive: true }); } catch {}

  console.log(`\nResults for ${zipName}:`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
}

// Run
console.log('TC Waves - Storage Zip Processor');
console.log('================================\n');
console.log(`Will process ${ZIP_FILES.length} zip files from Storage bucket: ${BUCKET_NAME}`);
console.log(`Images will be resized to max ${MAX_DIMENSION}px with ${THUMB_DIMENSION}px thumbnails\n`);

for (const zipFile of ZIP_FILES) {
  try {
    await processZipFile(zipFile);
  } catch (err) {
    console.error(`\nFATAL error processing ${zipFile}:`, err);
  }
}

console.log('\n================================');
console.log('All done!');
