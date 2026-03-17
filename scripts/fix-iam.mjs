import fs from 'fs';
import path from 'path';
import os from 'os';

const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const TOKEN = config.tokens.access_token;
const SA = 'serviceAccount:tcw-website-builder@appspot.gserviceaccount.com';

// Get current policy
const getPolicyRes = await fetch('https://cloudresourcemanager.googleapis.com/v1/projects/tcw-website-builder:getIamPolicy', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ options: { requestedPolicyVersion: 3 } }),
});
const policy = await getPolicyRes.json();

if (policy.error) {
  console.error('Error getting policy:', policy.error.message);
  process.exit(1);
}

// Add roles
const rolesToAdd = ['roles/editor', 'roles/datastore.user', 'roles/storage.admin'];
for (const role of rolesToAdd) {
  const existing = policy.bindings.find(b => b.role === role);
  if (existing) {
    if (!existing.members.includes(SA)) {
      existing.members.push(SA);
      console.log(`Added SA to existing ${role}`);
    } else {
      console.log(`Already has ${role}`);
    }
  } else {
    policy.bindings.push({ role, members: [SA] });
    console.log(`Created new binding for ${role}`);
  }
}

// Set updated policy
const setPolicyRes = await fetch('https://cloudresourcemanager.googleapis.com/v1/projects/tcw-website-builder:setIamPolicy', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ policy }),
});
const result = await setPolicyRes.json();

if (result.error) {
  console.error('Error setting policy:', result.error.message);
} else {
  console.log('IAM policy updated successfully!');

  // Verify
  const roles = result.bindings
    .filter(b => b.members?.includes(SA))
    .map(b => b.role);
  console.log('Roles for appspot SA:', roles.join(', '));
}
