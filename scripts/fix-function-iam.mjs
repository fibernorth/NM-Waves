import fs from 'fs';
import path from 'path';
import os from 'os';

const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const TOKEN = config.tokens.access_token;

const PROJECT = 'tcw-website-builder';
const REGION = 'us-central1';

// All callable functions that need public access
const functions = [
  'createCheckoutSession',
  'generateInvoiceToken',
  'batchGenerateInvoices',
  'batchAnalyzeMedia',
  'listDrivePhotos',
];

// Also onRequest functions that need public access
const httpFunctions = [
  'stripeWebhook',
  'triggerScrape',
  'sendParentInvites',
  'sendInvoiceEmails',
];

const allFunctions = [...functions, ...httpFunctions];

for (const fnName of allFunctions) {
  const url = `https://cloudfunctions.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/functions/${fnName}:setIamPolicy`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        policy: {
          bindings: [
            {
              role: 'roles/cloudfunctions.invoker',
              members: ['allUsers'],
            },
          ],
        },
      }),
    });

    const result = await res.json();

    if (result.error) {
      console.error(`${fnName}: ERROR - ${result.error.message}`);
    } else {
      console.log(`${fnName}: OK - allUsers invoker set`);
    }
  } catch (err) {
    console.error(`${fnName}: FETCH ERROR - ${err.message}`);
  }
}
