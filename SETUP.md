# Setup Instructions

## Issue with npm install

If you're experiencing SSL errors during `npm install`, this is due to an OpenSSL cipher issue with your Node.js installation.

## Solutions

### Option 1: Use a different Node version (Recommended)
```bash
# Install nvm (Node Version Manager) if you don't have it
# Then install a different Node version
nvm install 20
nvm use 20
npm install
```

### Option 2: Use Yarn instead of npm
```bash
# Install yarn globally
npm install -g yarn

# Then use yarn to install dependencies
yarn install
```

### Option 3: Try with environment variable
```bash
# On Windows PowerShell
$env:NODE_OPTIONS="--no-experimental-fetch"
npm install --legacy-peer-deps

# On Windows CMD
set NODE_OPTIONS=--no-experimental-fetch
npm install --legacy-peer-deps
```

### Option 4: Manual dependency installation
If all else fails, try installing dependencies in batches:

```bash
npm install react react-dom --legacy-peer-deps
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled --legacy-peer-deps
npm install firebase --legacy-peer-deps
npm install react-router-dom --legacy-peer-deps
npm install @tanstack/react-query --legacy-peer-deps
npm install react-hook-form @hookform/resolvers zod --legacy-peer-deps
npm install zustand react-hot-toast --legacy-peer-deps
npm install date-fns recharts --legacy-peer-deps
npm install @mui/x-data-grid --legacy-peer-deps
```

Then install dev dependencies:
```bash
npm install --save-dev @types/react @types/react-dom typescript vite @vitejs/plugin-react --legacy-peer-deps
npm install --save-dev @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint --legacy-peer-deps
npm install --save-dev eslint-plugin-react-hooks eslint-plugin-react-refresh --legacy-peer-deps
```

## After successful installation

1. Copy `.env.example` to `.env` and configure your Firebase credentials
2. Run `npm run dev` to start the development server
3. Open http://localhost:5173 in your browser

## Firebase Configuration

1. Go to https://console.firebase.google.com
2. Create a new project or select existing one
3. Enable Authentication > Email/Password sign-in method
4. Create a Firestore database (start in test mode, we'll deploy security rules later)
5. Go to Project Settings > General > Your apps
6. Add a web app and copy the Firebase config
7. Paste the config values into your `.env` file

## Deployment

Once the app is working locally:

```bash
# Build for production
npm run build

# Install Firebase CLI if you haven't
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (select Hosting and Firestore)
firebase init

# Deploy
firebase deploy
```
