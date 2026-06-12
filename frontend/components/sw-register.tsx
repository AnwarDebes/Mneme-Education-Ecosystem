"use client";
import { useEffect } from "react";
import { toast } from "sonner";
import { IS_PRODUCTION } from "@/lib/config";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!IS_PRODUCTION) return;
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Newly installed worker is waiting because an older one still
          // controls the page. Surface a toast that lets the user activate it.
          const promptUser = (worker: ServiceWorker) => {
            toast.message("Update available", {
              description: "A newer version of mneme is ready. Reload to use it.",
              action: {
                label: "Reload",
                onClick: () => {
                  worker.postMessage({ type: "SKIP_WAITING" });
                },
              },
              duration: 30_000,
            });
          };

          if (reg.waiting) promptUser(reg.waiting);

          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                promptUser(installing);
              }
            });
          });

          // When the new SW takes control after skipWaiting, reload to use it.
          let reloaded = false;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (reloaded) return;
            reloaded = true;
            window.location.reload();
          });
        })
        .catch(() => {
          /* offline / dev: ignore */
        });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);
  return null;
}
