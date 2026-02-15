# NM Waves - Softball Management System

A comprehensive web application for managing the Northern Michigan Waves travel softball club.

## Features

### Implemented (Priority 1)
- **Authentication**: Sign up, login, role-based access control
- **Teams Management**: Create, edit, view teams with coach assignments
- **Players Management**: Track player information and team assignments
- **Financial System**: Cost assumptions, player billing, payment tracking
- **Dashboard**: Overview of key metrics and quick actions

### Coming Soon (Priority 2)
- Documents management
- Schedules and calendar
- Volunteer coordination
- Media gallery
- Player metrics and statistics
- Scholarships
- Sponsor management
- Tournament registration

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Material-UI (MUI) v5
- **State Management**: Zustand (auth) + React Query (data)
- **Forms**: React Hook Form + Zod validation
- **Backend**: Firebase (Firestore, Auth, Hosting)
- **Routing**: React Router v6

## Getting Started

### Prerequisites
- Node.js 18+
- Firebase account and project

### Installation

1. Clone the repository
```bash
git clone <repo-url>
cd NM-Waves
```

2. Install dependencies
```bash
npm install
```

3. Configure Firebase
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication (Email/Password)
   - Create a Firestore database
   - Copy `.env.example` to `.env` and fill in your Firebase config

4. Start development server
```bash
npm run dev
```

5. Build for production
```bash
npm run build
```

### Firebase Deployment

1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

2. Login to Firebase
```bash
firebase login
```

3. Initialize Firebase (if not already done)
```bash
firebase init
```

4. Deploy
```bash
npm run build
firebase deploy
```

## User Roles

- **visitor**: Read-only access to public information
- **parent**: View team/player info, track payments
- **coach**: Manage players, view team information
- **admin**: Full access to teams, players, finances
- **super_admin**: Complete system access

## Project Structure

```
src/
├── components/       # Shared components
│   ├── auth/        # Authentication components
│   ├── common/      # Reusable UI components
│   └── layout/      # Layout components (Navbar, Sidebar)
├── features/        # Feature-based modules
│   ├── auth/        # Authentication pages
│   ├── dashboard/   # Dashboard
│   ├── teams/       # Team management
│   ├── players/     # Player management
│   ├── finances/    # Financial management
│   └── [others]/    # Stub features
├── lib/             # Libraries and utilities
│   ├── api/         # Firestore API layer
│   └── firebase/    # Firebase configuration
├── stores/          # Zustand stores
├── types/           # TypeScript type definitions
├── App.tsx          # Main app component
└── main.tsx         # Entry point
```

## Development Guidelines

- Use TypeScript for all new files
- Follow the feature-based architecture
- Use React Query for data fetching
- Use React Hook Form + Zod for forms
- Follow Material-UI design patterns
- Add proper error handling and loading states

## License

Private - NM Waves Organization
