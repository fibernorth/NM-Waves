# Manual Node 20 Installation Guide

## The Problem

Your system has Node.js 22.17.0 which has an OpenSSL cipher compatibility issue preventing npm from downloading packages. This affects:
- npm install
- curl downloads
- Any TLS/SSL network operations

## Solution: Install Node 20 Manually

### Step 1: Download Node 20 Installer

1. Open your web browser (Chrome, Edge, Firefox, etc.)
2. Go to: **https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi**
3. The MSI installer will download (about 30 MB)
4. Save it to your Downloads folder

### Step 2: Run the Installer

1. Double-click the downloaded `node-v20.18.1-x64.msi` file
2. Click "Yes" if prompted by User Account Control
3. Follow the installation wizard:
   - Click "Next"
   - Accept the license agreement
   - Choose installation location (default is fine: `C:\Program Files\nodejs`)
   - **IMPORTANT**: Select "Automatically install the necessary tools"
   - Click "Next" then "Install"
4. Wait for installation to complete (2-3 minutes)
5. Click "Finish"

### Step 3: Restart Your Terminal

**CRITICAL**: You MUST close and reopen your terminal/command prompt/PowerShell for the new Node version to be recognized.

1. Close ALL terminal windows
2. Close Claude Code if it's open
3. Reopen Claude Code or your terminal

### Step 4: Verify Installation

Open a new terminal and run:

```bash
node --version
```

You should see: `v20.18.1`

If you still see `v22.17.0`:
1. Restart your computer
2. Try again

### Step 5: Install Project Dependencies

Once Node 20 is confirmed:

```bash
cd C:\Users\bill\projects\NM-Waves
npm install --legacy-peer-deps
```

This should now work without SSL errors!

## Alternative: Use Node Version Manager (nvm-windows)

If you want to easily switch between Node versions:

1. Download nvm-windows from: **https://github.com/coreybutler/nvm-windows/releases**
2. Download `nvm-setup.exe` from the latest release
3. Run the installer
4. Close and reopen terminal
5. Run these commands:

```bash
nvm install 20.18.1
nvm use 20.18.1
node --version  # Should show v20.18.1
```

Then install dependencies:

```bash
cd C:\Users\bill\projects\NM-Waves
npm install --legacy-peer-deps
```

## What Happens After Installation

Once dependencies are installed successfully, you'll see:

```
added 367 packages, and audited 368 packages in 2m

found 0 vulnerabilities
```

Then you can:

1. Configure Firebase (see QUICKSTART.md)
2. Start the development server:

```bash
npm run dev
```

3. Open http://localhost:5173 in your browser
4. Sign up and start using the app!

## Still Having Issues?

If you continue having problems:

1. **Check your antivirus**: Some antivirus software blocks Node.js operations
2. **Check your proxy**: If you're behind a corporate proxy, npm needs configuration
3. **Use a different network**: Try mobile hotspot or different WiFi
4. **Contact support**: The SSL cipher issue might be a deeper system problem

## Quick Links

- Node 20.18.1 Installer: https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi
- nvm-windows Releases: https://github.com/coreybutler/nvm-windows/releases
- Node.js Downloads Page: https://nodejs.org/en/download
- Project README: See README.md in this folder
