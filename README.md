**MSc Thesis Sprint Tracker**

This is a simple, self-contained Kanban board to track the progress of a 3-week (21-day) intensive thesis sprint. It is designed to be a lightweight, personal project management tool.

It is built with HTML, Tailwind CSS for styling, and plain JavaScript for interactivity.

**Features**

- **Drag-and-Drop:** Easily move tasks between "To Do," "In Progress," and "Done."
- **Persistent State:** Your task board saves its state in your browser's **localStorage**. You can close the tab and your progress will be there when you return.
- **Color-Coded Tags:** Tasks are visually tagged by type:
  - **PHASE (Red):** High-level project phases.
  - **SPRINT (Orange):** Weekend-long, high-effort tasks.
  - **MICRO (Blue):** Weekday, 1-2 hour microtasks.
  - **AI (Purple):** Tasks where AI tools (Gemini, ChatGPT) can be leveraged.
  - **WRITE (Pink):** Specific writing-focused tasks.
- **Task Counters:** Each column shows the current number of tasks.
- **Responsive:** Usable on both desktop and mobile browsers.

**How to Use**

This is a single, static HTML file. No build process or servers are required.

### Configure Firebase (for GitHub Pages + local dev)

1. **Create your config JSON locally**
   - Copy `firebase-config.template.json` to `firebase-config.json` (this file is `.gitignore`'d).
   - Fill in `boardAppId`, `firebaseConfig` (apiKey, authDomain, etc.), and `initialAuthToken` only if you use a custom token flow.
   - Keep this file private—do not commit it.
2. **Store the config in GitHub Secrets**
   - Open your repo → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*.
   - Name it `FIREBASE_CONFIG_JSON` and paste the **entire JSON** (minified or pretty-printed is fine).
   - Prefer Firebase API keys with HTTP referrer restrictions and locked-down Firestore rules.
3. **Deploy via GitHub Pages workflow**
   - The workflow `.github/workflows/static.yml` now writes `firebase-config.json` during the build using the secret, so Pages gets the same config without exposing it in git history.
   - If the secret is missing, the workflow fails fast to avoid publishing a broken build.
4. **Rotate / update**
   - Update your local `firebase-config.json` and the `FIREBASE_CONFIG_JSON` secret together whenever keys or IDs change.
   - Remove any obsolete keys from Firebase console to prevent orphaned credentials.

**1\. Local Use**

- Download the Thesis_Kanban_Tracker_v2.html file.
- Double-click it to open it in your preferred web browser (Chrome, Firefox, Safari, Edge).
- Start dragging your tasks. Your progress will be saved automatically in that browser.

**2\. Live Deployment (GitHub Pages)**

This repository is deployed using GitHub Pages.

You can access the live, persistent tracker at:

**https://\[YOUR_USERNAME\].github.io/thesis-tracker/Thesis_Kanban_Tracker_v2.html**

_(You will need to replace \[YOUR_USERNAME\] with your actual GitHub username after you deploy it following the guide.)_

**File Structure**

/
│
├── index.html (The entire web application)
│
└── README.md
