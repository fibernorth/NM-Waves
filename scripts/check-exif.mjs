import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import exifReader from 'exif-reader';
import { readFileSync } from 'fs';

const key = JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(key), projectId: 'tcw-website-builder', storageBucket: 'tcw-website-builder.firebasestorage.app' });
const bucket = getStorage().bucket();

async function checkExif() {
  const [allFiles] = await bucket.getFiles({ prefix: 'media/drive_download', maxResults: 2000 });
  const imageFiles = allFiles.filter(f => f.name.indexOf('/thumbs/') === -1 && f.name.endsWith('.jpg'));

  // Sample 10 images spread across the collection
  const step = Math.max(1, Math.floor(imageFiles.length / 10));
  const samples = [];
  for (let i = 0; i < 10 && i * step < imageFiles.length; i++) {
    samples.push(imageFiles[i * step]);
  }

  console.log('Total images (non-thumb):', imageFiles.length);
  console.log('Checking', samples.length, 'samples for EXIF data...\n');

  let withExif = 0;
  let withGPS = 0;
  let withDate = 0;

  for (const file of samples) {
    const [buffer] = await file.download();
    const metadata = await sharp(buffer).metadata();
    const name = file.name.split('/').pop();

    console.log('File:', name);
    console.log('  Size:', buffer.length, '| Format:', metadata.format, '|', metadata.width + 'x' + metadata.height);

    if (metadata.exif) {
      withExif++;
      try {
        const exif = exifReader(metadata.exif);

        if (exif.exif?.DateTimeOriginal) {
          withDate++;
          console.log('  Date:', exif.exif.DateTimeOriginal);
        } else if (exif.exif?.DateTimeDigitized) {
          withDate++;
          console.log('  Date (digitized):', exif.exif.DateTimeDigitized);
        }
        if (exif.gps?.GPSLatitude) {
          withGPS++;
          const lat = exif.gps.GPSLatitude[0] + exif.gps.GPSLatitude[1] / 60 + exif.gps.GPSLatitude[2] / 3600;
          const lon = exif.gps.GPSLongitude[0] + exif.gps.GPSLongitude[1] / 60 + exif.gps.GPSLongitude[2] / 3600;
          console.log('  GPS:', lat.toFixed(6), exif.gps.GPSLatitudeRef, ',', lon.toFixed(6), exif.gps.GPSLongitudeRef);
        }
        if (exif.image?.Make) console.log('  Camera:', exif.image.Make, exif.image.Model || '');
      } catch (e) {
        console.log('  EXIF parse error:', e.message);
      }
    } else {
      console.log('  No EXIF data');
    }
    console.log();
  }

  console.log('=== Summary ===');
  console.log('With EXIF:', withExif + '/' + samples.length);
  console.log('With Date:', withDate + '/' + samples.length);
  console.log('With GPS:', withGPS + '/' + samples.length);

  // Check filename patterns across all images
  console.log('\n=== Filename patterns ===');
  const patterns = { PXL: 0, DSC: 0, IMG: 0, other: 0 };
  let dateInNameCount = 0;
  const sampleDates = [];

  imageFiles.forEach(f => {
    const n = f.name.split('/').pop();
    if (n.startsWith('PXL_')) patterns.PXL++;
    else if (n.startsWith('DSC_')) patterns.DSC++;
    else if (n.startsWith('IMG_')) patterns.IMG++;
    else patterns.other++;

    // Check for date in filename: YYYYMMDD pattern
    const dateMatch = n.match(/(20[12]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
    if (dateMatch) {
      dateInNameCount++;
      if (sampleDates.length < 5) sampleDates.push(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]} (${n})`);
    }
  });

  console.log('PXL_ (Pixel phone):', patterns.PXL);
  console.log('DSC_ (DSLR):', patterns.DSC);
  console.log('IMG_ (iPhone/other):', patterns.IMG);
  console.log('Other:', patterns.other);
  console.log('Files with date in name:', dateInNameCount, '/', imageFiles.length);
  if (sampleDates.length > 0) {
    console.log('Sample dates from filenames:');
    sampleDates.forEach(d => console.log(' ', d));
  }
}

checkExif().catch(e => console.error(e));
