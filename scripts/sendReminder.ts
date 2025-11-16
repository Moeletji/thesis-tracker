import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

import type { Task } from "../src/types";
import {
  buildSprintSchedule,
  describeTaskDeadline,
  ensureSprintDates,
  formatDateRange,
  getActiveSprint,
  getOutstandingTasks,
  longDateFormatter,
  resolveTaskSprintIndex,
} from "../src/utils/sprint";

const boardId =
  process.env.FIREBASE_BOARD_ID?.trim() ||
  process.env.VITE_FIREBASE_BOARD_ID?.trim() ||
  "shared-board";

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

async function main() {
  const serviceAccountJson = requireEnv("FIREBASE_SERVICE_ACCOUNT");
  const reminderTo = requireEnv("REMINDER_TO_EMAIL");
  const reminderFrom = requireEnv("REMINDER_FROM_EMAIL");
  const smtpHost = requireEnv("SMTP_HOST");
  const smtpPort = Number(requireEnv("SMTP_PORT"));
  const smtpUsername = requireEnv("SMTP_USERNAME");
  const smtpPassword = requireEnv("SMTP_PASSWORD");

  const serviceAccount = JSON.parse(serviceAccountJson);
  initializeApp({
    credential: cert(serviceAccount),
  });

  const db = getFirestore();
  const boardSnapshot = await db.collection("boards").doc(boardId).get();
  if (!boardSnapshot.exists) {
    throw new Error(
      `Board document boards/${boardId} does not exist in Firestore.`
    );
  }

  const data = boardSnapshot.data() ?? {};
  const rawTasks = Array.isArray(data.tasks) ? (data.tasks as Task[]) : [];
  const schedule = buildSprintSchedule();
  const { tasks } = ensureSprintDates(rawTasks, schedule);
  const activeSprint = getActiveSprint(schedule);
  const outstanding = getOutstandingTasks(tasks);
  const sprintOutstanding = outstanding.filter(
    (task) =>
      task.type === "task-sprint" &&
      resolveTaskSprintIndex(task) === activeSprint.index
  );

  if (sprintOutstanding.length === 0) {
    console.log("No outstanding sprint tasks. Email skipped.");
    await db
      .collection("reminders")
      .doc(boardId)
      .set(
        {
          email: reminderTo,
          snapshot: {
            generatedAt: Date.now(),
            sprintIndex: activeSprint.index,
            sprintStart: activeSprint.start.toISOString(),
            sprintEnd: activeSprint.end.toISOString(),
            overflowEnd: activeSprint.overflowEnd.toISOString(),
            outstandingCount: 0,
            outstandingTasks: [],
          },
        },
        { merge: true }
      );
    return;
  }

  const summaryLines = sprintOutstanding
    .map((task) => {
      const descriptor = describeTaskDeadline(task);
      return `• [${task.column.toUpperCase()}] ${task.title} — ${descriptor.label}`;
    })
    .join("\n");

  const subject = `Sprint ${activeSprint.index} Reminder · ${sprintOutstanding.length} task(s) pending`;
  const body = [
    "Here is your MSc Thesis sprint reminder.",
    "",
    `Sprint window: ${formatDateRange(
      activeSprint.start,
      activeSprint.end
    )}`,
    `Overflow ends: ${longDateFormatter.format(activeSprint.overflowEnd)}`,
    "",
    summaryLines,
    "",
    `Board ID: ${boardId}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join("\n");

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUsername,
      pass: smtpPassword,
    },
  });

  await transporter.sendMail({
    from: reminderFrom,
    to: reminderTo,
    subject,
    text: body,
  });
  console.log(`Reminder email sent to ${reminderTo}.`);

  const now = Date.now();
  await db
    .collection("reminders")
    .doc(boardId)
    .set(
      {
        email: reminderTo,
        lastNotifiedAt: now,
          snapshot: {
            generatedAt: now,
            sprintIndex: activeSprint.index,
            sprintStart: activeSprint.start.toISOString(),
            sprintEnd: activeSprint.end.toISOString(),
            overflowEnd: activeSprint.overflowEnd.toISOString(),
            outstandingCount: sprintOutstanding.length,
            outstandingTasks: sprintOutstanding.map((task) => ({
              id: task.id,
            title: task.title,
            column: task.column,
            dueDate: task.dueDate,
            overflowDate: task.overflowDate,
          })),
        },
      },
      { merge: true }
    );
}

main().catch((error) => {
  console.error("Failed to send sprint reminder", error);
  process.exitCode = 1;
});
