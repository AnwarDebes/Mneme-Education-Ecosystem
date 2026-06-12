"use client";
// Browser notifications for due cards. Honors a localStorage opt-in toggle
// AND the browser's own Notification permission. We don't poll; the caller
// runs ``maybeNotifyDue`` once on app boot.

import { readJSON, writeJSON, notifyStorageChange } from "./storage";

const SETTING_KEY = "settings:notifications";
const LAST_KEY = "settings:notifications:last";

export interface NotificationSettings {
  enabled: boolean;
  dailyHourLocal: number;
}

export function loadNotificationSettings(): NotificationSettings {
  return readJSON<NotificationSettings>(SETTING_KEY, { enabled: false, dailyHourLocal: 9 });
}

export function saveNotificationSettings(s: NotificationSettings): void {
  writeJSON(SETTING_KEY, s);
  notifyStorageChange();
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export async function maybeNotifyDue(totalDue: number): Promise<void> {
  if (!notificationsSupported()) return;
  const settings = loadNotificationSettings();
  if (!settings.enabled) return;
  if (Notification.permission !== "granted") return;
  if (totalDue <= 0) return;

  const last = readJSON<string>(LAST_KEY, "");
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (last === today) return;
  if (now.getHours() < settings.dailyHourLocal) return;

  try {
    new Notification("mneme - cards due", {
      body: `${totalDue} card${totalDue === 1 ? "" : "s"} ready to review today.`,
      tag: "mneme-due",
      requireInteraction: false,
    });
    writeJSON(LAST_KEY, today);
  } catch {
    /* ignore */
  }
}
