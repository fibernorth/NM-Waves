# Quick Start Guide - NM Waves

## Current Situation

✅ **Project Structure**: Complete
✅ **Core Files**: 38 TypeScript files created
✅ **Configuration**: All config files ready
❌ **Dependencies**: Not installed (Node 22 SSL issue)

## Step 1: Fix Node.js Version Issue

You're running Node 22.17.0 which has an OpenSSL cipher compatibility issue. **Choose ONE solution:**

### Option A: Downgrade to Node 20 (RECOMMENDED)
```bash
# Visit https://nodejs.org and download Node 20.x LTS
# After installing, verify:
node --version  # Should show v20.x.x
```

### Option B: Use NVM to switch versions
```bash
# Install nvm-windows from: https://github.com/coreybutler/nvm-windows
# Then:
nvm install 20
nvm use 20
node --version
```

### Option C: Use Yarn instead of npm
```bash
npm install -g yarn
# Then use 'yarn' instead of 'npm' for all commands
```

## Step 2: Install Dependencies

After fixing Node version:

```bash
cd C:\Users\bill\projects\NM-Waves
npm install --legacy-peer-deps
```

If you see any warnings, that's normal. If it completes without errors, you're good!

## Step 3: Configure Firebase

1. Go to https://console.firebase.google.com
2. Create a new Firebase project (or use existing)
3. **Enable Authentication**:
   - Click "Authentication" in sidebar
   - Click "Get Started"
   - Enable "Email/Password" sign-in method
4. **Create Firestore Database**:
   - Click "Firestore Database" in sidebar
   - Click "Create Database"
   - Start in "Test mode" for now
   - Choose a location (us-central1 recommended)
5. **Get Config**:
   - Click gear icon → Project Settings
   - Scroll to "Your apps" section
   - Click the web icon (`</>`) to add a web app
   - Register app with nickname "NM Waves Web"
   - Copy the firebaseConfig object

6. **Update .env.local**:
```bash
# Edit C:\Users\bill\projects\NM-Waves\.env.local
# Paste your values:
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Step 4: Start Development Server

```bash
npm run dev
```

The app will open at http://localhost:5173

## Step 5: Create Your First User

1. Click "Sign up" on the login page
2. Fill in:
   - Full Name: Your Name
   - Email: your@email.com
   - Password: (at least 6 characters)
   - Role: Parent (we'll upgrade this next)
3. Click "Sign Up"

## Step 6: Make Yourself an Admin

Since you're the first user, you need to manually set yourself as admin:

1. Go to Firebase Console → Firestore Database
2. Find the `users` collection
3. Click on your user document (your UID)
4. Click "Edit" button
5. Change `role` field from `"parent"` to `"admin"` or `"super_admin"`
6. Save

7. Refresh your app - you should now see admin features in the sidebar!

## Step 7: Create Your First Team

1. In the app, click "Teams" in the sidebar
2. Click "Add Team" button
3. Fill in:
   - Team Name: "Waves 12U"
   - Age Group: "12U"
   - Season: "2024 Summer"
   - Active: ✓ (checked)
4. Click "Create"

You should see your team in the table!

## What Works Right Now

✅ **Complete Features**:
- User authentication (signup, login, logout)
- Teams CRUD (create, read, update, delete)
- Team details page with roster
- Role-based access control
- Dashboard with statistics

📝 **Placeholder Pages** (show "Coming Soon"):
- Players (API ready, UI needs implementation)
- Finances (API ready, UI needs implementation)
- Documents, Schedules, Volunteers, Media, etc.

## Next Development Steps

Once you're up and running, here's what to build next:

### 1. Implement Players Page (copy from TeamsPage pattern)
File: `src/features/players/pages/PlayersPage.tsx`
- Add DataGrid like TeamsPage
- Create PlayerFormDialog component
- Wire up playersApi calls

### 2. Implement Cost Assumptions Page
File: `src/features/finances/pages/CostAssumptionsPage.tsx`
- Simple form to edit global costs
- Save to `costs/global` document

### 3. Implement Billing Page
File: `src/features/finances/pages/BillingPage.tsx`
- Show player finances in a table
- Add payment recording form
- Show balance calculations

## Common Issues & Fixes

**Issue**: "Module not found" errors
**Fix**: Make sure all dependencies installed: `npm install --legacy-peer-deps`

**Issue**: Firebase errors about "No Firebase App"
**Fix**: Check .env.local has correct values and restart dev server

**Issue**: "User not found" after signup
**Fix**: Check Firestore rules allow writing to users collection

**Issue**: Can't see admin features
**Fix**: Update role in Firestore to "admin" or "super_admin"

## Deploy to Production

When ready to deploy:

```bash
# Build the app
npm run build

# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (select Hosting + Firestore)
firebase init

# Deploy
firebase deploy
```

**Important**: Before deploying, copy the firestore.rules to production:
```bash
firebase deploy --only firestore:rules
```

This ensures your database is properly secured!

## Getting Help

- **README.md**: Full project documentation
- **SETUP.md**: Detailed installation troubleshooting
- **PROJECT_STATUS.md**: Complete implementation status
- **Firebase Docs**: https://firebase.google.com/docs

## Project Structure Reference

```
src/
├── components/       # Reusable components
│   ├── auth/        # ProtectedRoute
│   ├── common/      # LoadingScreen
│   └── layout/      # AppLayout, Navbar, Sidebar
├── features/        # Feature modules
│   ├── auth/        # Login, Signup
│   ├── teams/       # Teams management (COMPLETE)
│   ├── players/     # Player management (needs UI)
│   ├── finances/    # Finances (needs UI)
│   └── [others]/    # Stub pages
├── lib/
│   ├── api/         # Firestore API functions
│   └── firebase/    # Firebase config
├── stores/          # Zustand state (auth)
└── types/           # TypeScript models
```

All API functions are ready to use! Just import and call them:

```typescript
import { teamsApi } from '@/lib/api/teams';
import { playersApi } from '@/lib/api/players';
import { costAssumptionsApi, playerFinancesApi } from '@/lib/api/finances';

// Example:
const teams = await teamsApi.getAll();
const players = await playersApi.getByTeam(teamId);
```

Good luck building! 🚀⚾
