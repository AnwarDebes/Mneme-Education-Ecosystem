// Tiny i18n primitive. Loads a flat key->string dictionary keyed by locale
// and exposes a t() helper with %s substitution. Default locale is "en".
// We ship English only; adding a second locale is a one-file addition.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import { useEffect, useState } from "react";

export type Locale = "en" | "es";

const KEY = "settings:locale";

const DICTIONARIES: Record<Locale, Record<string, string>> = {
  en: {
    "nav.library": "Library",
    "nav.today": "Today",
    "nav.insights": "Insights",
    "nav.feed": "Feed",
    "nav.mistakes": "Mistakes",
    "nav.search": "Search",
    "nav.learn": "Learn",
    "nav.help": "Help",
    "nav.cards": "Cards",
    "nav.generate": "Generate",
    "nav.home": "Home",
    "nav.study": "Study",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.cards": "%s cards",
    "study.flip": "Flip",
    "study.quiz": "Quiz",
    "study.write": "Write",
    "study.cram": "Cram",
    "study.test": "Test",
    "study.again": "Again",
    "study.hard": "Hard",
    "study.good": "Good",
    "study.easy": "Easy",
  },
  es: {
    "nav.library": "Biblioteca",
    "nav.today": "Hoy",
    "nav.insights": "Estadisticas",
    "nav.feed": "Actividad",
    "nav.mistakes": "Errores",
    "nav.search": "Buscar",
    "nav.learn": "Aprender",
    "nav.help": "Ayuda",
    "nav.cards": "Tarjetas",
    "nav.generate": "Generar",
    "nav.home": "Inicio",
    "nav.study": "Estudiar",
    "common.cancel": "Cancelar",
    "common.save": "Guardar",
    "common.delete": "Eliminar",
    "common.cards": "%s tarjetas",
    "study.flip": "Voltear",
    "study.quiz": "Quiz",
    "study.write": "Escribir",
    "study.cram": "Repaso",
    "study.test": "Examen",
    "study.again": "Otra vez",
    "study.hard": "Dificil",
    "study.good": "Bien",
    "study.easy": "Facil",
  },
};

export function loadLocale(): Locale {
  return readJSON<Locale>(KEY, "en");
}

export function saveLocale(locale: Locale): void {
  writeJSON(KEY, locale);
  notifyStorageChange();
}

export function t(key: string, ...args: (string | number)[]): string {
  const locale = loadLocale();
  let s = DICTIONARIES[locale]?.[key] ?? DICTIONARIES.en[key] ?? key;
  for (const a of args) s = s.replace("%s", String(a));
  return s;
}

export function useLocale(): [Locale, (l: Locale) => void] {
  const [l, setL] = useState<Locale>("en");
  useEffect(() => setL(loadLocale()), []);
  const set = (next: Locale) => {
    saveLocale(next);
    setL(next);
  };
  return [l, set];
}
