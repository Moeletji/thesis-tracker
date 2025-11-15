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
├── Thesis_Kanban_Tracker_v2.html (The entire web application)
│
└── README.md
