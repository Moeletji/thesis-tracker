# MSc Thesis Sprint Tracker

React + TypeScript rewrite of the thesis kanban board. The UI mirrors the original single-page experience, but the data layer now lives in a Vite application with Firebase handled via environment variables so no credentials are committed to the repo.

## Features

- Real-time board state stored under `/boards/{boardId}` in Firestore so every device sees the same card positions.
- Anonymous Firebase Auth session established before any reads/writes.
- Drag-and-drop cards, quick detail modal with sanitized HTML, and a status banner that surfaces deployment info.
- Sprint window panel that assigns weekly due dates + overflow buffers to every task.
- Friday reminder pipeline powered by GitHub Actions + SMTP so you get emails about unfinished sprint work without needing Firebase Functions.
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
| `VITE_NOTIFICATION_EMAIL`             | Destination email for the Friday sprint reminder |

## Reminder Automation (Free Tier Friendly)

The board tracks outstanding sprint work in Firestore and mirrors the latest snapshot to `/reminders/{boardId}`. A GitHub Actions job (defined in `.github/workflows/static.yml`) runs every Friday at 09:00 UTC, executes `npm run reminder:run`, and sends an email via SMTP with the open sprint tasks. No Firebase Functions or paid add-ons are required.

The `scripts/sendReminder.ts` runner expects the following repository secrets:

| Secret | Purpose |
| ------ | ------- |
| `FIREBASE_SERVICE_ACCOUNT` | JSON contents of a Firebase service account with access to Firestore (copy the JSON into the secret as-is). |
| `FIREBASE_BOARD_ID`        | Same value you use in the UI (`shared-board` by default). |
| `REMINDER_TO_EMAIL`        | Address that should receive the sprint digest. |
| `REMINDER_FROM_EMAIL`      | From header shown in the email (must match your SMTP account for Gmail). |
| `SMTP_HOST` / `SMTP_PORT`  | SMTP server host/port (e.g., `smtp.gmail.com` / `465`). |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | Credentials for the SMTP server (for Gmail, generate an App Password and use your Gmail address as the username). |

During the reminder run the script:

1. Reads `/boards/{boardId}` and ensures each task has a due/overflow date.
2. Builds a summary of non-`done` sprint tasks.
3. Sends a plaintext email via `nodemailer`.
4. Updates `/reminders/{boardId}` with the timestamp + snapshot so the UI can display the last send time.

If there are no open sprint tasks, the workflow exits gracefully without sending an email.

## GitHub Actions Deployment

The workflow in `.github/workflows/static.yml` installs dependencies, writes a `.env` file from repository secrets, runs the production build, and publishes the `dist` folder to GitHub Pages. It also contains a scheduled job (`cron: 0 9 * * 5`) that invokes the reminder script described above.

Configure these secrets for the Pages deployment:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_BOARD_ID`
- `REMINDER_TO_EMAIL` (re-used so the UI can display who receives notifications)

Add the SMTP + service account secrets from the reminder table so the scheduled job can authenticate and send mail.
## Tech Stack

- React 19 + TypeScript
- Vite 7
- Firebase (Auth + Firestore)
- DOMPurify for safe HTML rendering
