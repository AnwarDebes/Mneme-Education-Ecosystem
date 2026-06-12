"use client";
import { useEffect } from "react";
import { apply, loadVariant } from "@/lib/theme-variant";
import { dueCardIds } from "@/lib/schedule";
import { jobDetail, listJobs } from "@/lib/api";
import { maybeNotifyDue } from "@/lib/notifications";
import { applyCustomCss, loadCustomCss } from "@/lib/custom-css";

export function AppBoot() {
  useEffect(() => {
    apply(loadVariant());
    applyCustomCss(loadCustomCss());

    // Once per app load, if notifications are enabled and there are due
    // cards across the library, fire a single browser notification.
    (async () => {
      try {
        const jobs = await listJobs();
        const done = jobs.filter((j) => j.status === "done");
        let totalDue = 0;
        for (const j of done.slice(0, 30)) {
          try {
            const d = await jobDetail(j.id);
            totalDue += dueCardIds(j.id, d.cards.map((c) => c.id)).length;
          } catch {
            /* skip */
          }
        }
        await maybeNotifyDue(totalDue);
      } catch {
        /* offline is fine */
      }
    })();
  }, []);

  return null;
}
