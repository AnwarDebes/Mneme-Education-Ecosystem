// Build an .ics (iCalendar) file from the active study plans + exam plans.
// Drop the file into Apple Calendar / Google / Outlook for native reminders.

import { loadExamPlans, type ExamPlan } from "./exam-plan";
import { loadAllPlans, type StudyPlan } from "./study-plan";

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function icsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  );
}

function escape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function fold(line: string): string {
  // RFC 5545: lines should be folded at 75 chars.
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const slice = line.slice(i, i + 73);
    out.push(i === 0 ? slice : " " + slice);
    i += 73;
  }
  return out.join("\r\n");
}

function event(uid: string, dtStart: Date, summary: string, description: string, durationMin = 30): string[] {
  const dtEnd = new Date(dtStart.getTime() + durationMin * 60 * 1000);
  return [
    "BEGIN:VEVENT",
    `UID:${uid}@mneme.local`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(dtStart)}`,
    `DTEND:${icsDate(dtEnd)}`,
    fold(`SUMMARY:${escape(summary)}`),
    fold(`DESCRIPTION:${escape(description)}`),
    "END:VEVENT",
  ];
}

interface CalendarOpts {
  hourLocal?: number;
  durationMin?: number;
}

export function buildStudyCalendar(opts?: CalendarOpts): string {
  const hour = opts?.hourLocal ?? 18;
  const duration = opts?.durationMin ?? 25;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mneme//Study Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:mneme study",
  ];

  for (const plan of loadAllPlans() as StudyPlan[]) {
    const target = new Date(plan.target_date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(Math.max(today.getTime(), new Date(plan.created_at).getTime()));
    start.setHours(0, 0, 0, 0);
    let cursor = new Date(start);
    let i = 0;
    while (cursor <= target && i < 120) {
      const dt = new Date(cursor);
      dt.setHours(hour, 0, 0, 0);
      lines.push(
        ...event(
          `study-${plan.deck_id}-${cursor.toISOString().slice(0, 10)}`,
          dt,
          `mneme study: ${plan.goal}`,
          `Target ${plan.cards_per_day} cards from your deck.`,
          duration,
        ),
      );
      cursor.setDate(cursor.getDate() + 1);
      i += 1;
    }
  }

  for (const plan of loadExamPlans() as ExamPlan[]) {
    for (const session of plan.sessions) {
      const dt = new Date(session.date + "T00:00:00");
      dt.setHours(hour, 0, 0, 0);
      lines.push(
        ...event(
          `exam-${plan.id}-${session.date}`,
          dt,
          `mneme practice exam: ${plan.name}`,
          `${session.question_count} questions in ${session.duration_min} min.`,
          session.duration_min,
        ),
      );
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
