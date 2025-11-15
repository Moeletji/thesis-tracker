# MSc Thesis Sprint Tracker

React + TypeScript rewrite of the thesis kanban board. The UI mirrors the original single-page experience, but the data layer now lives in a Vite application with Firebase handled via environment variables so no credentials are committed to the repo.

## Features

- Real-time board state stored under `/boards/{boardId}` in Firestore so every device sees the same card positions.
- Anonymous Firebase Auth session established before any reads/writes.
- Drag-and-drop cards, quick detail modal with sanitized HTML, and a status banner that surfaces deployment info.
- Secrets kept out of the repo. Builds populate `VITE_*` variables via the GitHub Action or a local `.env` file.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create a `.env` from the sample**
   ```bash
   cp .env.example .env
   # Fill in your Firebase project values
   ```
3. **Run locally**
   ```bash
   npm run dev
   ```
   Vite serves the app on http://localhost:5173 by default.

## Firebase Setup

1. Enable Anonymous Authentication in the Firebase console.
2. Create a document at `boards/<VITE_FIREBASE_BOARD_ID>` with a `tasks` array (you can paste the default tasks from `src/data/initialTasks.ts`).  
3. Firestore rules (extend as needed):
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /boards/{boardId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

## Environment Variables

| Key                                   | Description                                |
| ------------------------------------- | ------------------------------------------ |
| `VITE_FIREBASE_API_KEY`               | Firebase Web API key                       |
| `VITE_FIREBASE_AUTH_DOMAIN`           | `*.firebaseapp.com` auth domain            |
| `VITE_FIREBASE_PROJECT_ID`            | Firebase project id                        |
| `VITE_FIREBASE_STORAGE_BUCKET`        | Storage bucket                             |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`   | Sender id                                  |
| `VITE_FIREBASE_APP_ID`                | App id                                     |
| `VITE_FIREBASE_BOARD_ID`              | Firestore board document id (defaults to `shared-board`) |

## GitHub Actions Deployment

The workflow in `.github/workflows/static.yml` installs dependencies, writes a `.env` file from repository secrets, runs the production build, and publishes the `dist` folder to GitHub Pages. Configure the following secrets in your repository before running the workflow:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_BOARD_ID`

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Firebase (Auth + Firestore)
- DOMPurify for safe HTML rendering
