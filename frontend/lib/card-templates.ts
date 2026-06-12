// Predefined card templates for the Add Card dialog. Each is a shape the
// user can fill in - blanks like {{term}} are replaced with their input.

export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; multiline?: boolean }[];
  build: (values: Record<string, string>) => { question: string; answer: string; tags: string[] };
}

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: "definition",
    name: "Definition",
    description: "Term -> short definition. The fastest recall pattern.",
    fields: [
      { key: "term", label: "Term", placeholder: "Mitochondrion" },
      { key: "definition", label: "Definition", placeholder: "Organelle that produces ATP", multiline: true },
    ],
    build: (v) => ({
      question: `What is ${v.term.trim()}?`,
      answer: v.definition.trim(),
      tags: ["definition"],
    }),
  },
  {
    id: "process",
    name: "Process / mechanism",
    description: "Step-by-step explanation of how something happens.",
    fields: [
      { key: "process", label: "Process", placeholder: "DNA replication" },
      { key: "steps", label: "Steps (one per line)", placeholder: "Unwind...\nPrime...\nElongate...", multiline: true },
    ],
    build: (v) => {
      const steps = v.steps
        .split("\n")
        .map((s, i) => `${i + 1}. ${s.trim()}`)
        .filter((s) => s.length > 3)
        .join("\n");
      return {
        question: `What are the steps of ${v.process.trim()}?`,
        answer: steps,
        tags: ["process"],
      };
    },
  },
  {
    id: "cause-effect",
    name: "Cause -> effect",
    description: "X happens; what follows?",
    fields: [
      { key: "cause", label: "Cause", placeholder: "Sodium-potassium pump fails" },
      { key: "effect", label: "Effect", placeholder: "Cells swell and lyse" },
    ],
    build: (v) => ({
      question: `What happens when ${v.cause.trim()}?`,
      answer: v.effect.trim(),
      tags: ["cause-effect"],
    }),
  },
  {
    id: "compare",
    name: "Compare A vs B",
    description: "Side-by-side contrast.",
    fields: [
      { key: "a", label: "A", placeholder: "Mitosis" },
      { key: "b", label: "B", placeholder: "Meiosis" },
      { key: "diff", label: "Key difference", placeholder: "Mitosis produces 2 diploid cells; meiosis produces 4 haploid cells.", multiline: true },
    ],
    build: (v) => ({
      question: `What is the key difference between ${v.a.trim()} and ${v.b.trim()}?`,
      answer: v.diff.trim(),
      tags: ["compare"],
    }),
  },
  {
    id: "example",
    name: "Concept + example",
    description: "Anchor a concept with one concrete instance.",
    fields: [
      { key: "concept", label: "Concept", placeholder: "Negative feedback loop" },
      { key: "example", label: "Example", placeholder: "Thermostat regulates room temperature", multiline: true },
    ],
    build: (v) => ({
      question: `Give an example of ${v.concept.trim()}.`,
      answer: v.example.trim(),
      tags: ["example"],
    }),
  },
  {
    id: "formula",
    name: "Formula",
    description: "Math/physics/chem expression with what it computes.",
    fields: [
      { key: "name", label: "Name", placeholder: "Newton's second law" },
      { key: "formula", label: "Formula (LaTeX OK)", placeholder: "F = m \\cdot a" },
      { key: "meaning", label: "Variables / context", placeholder: "F = force (N), m = mass (kg), a = acceleration (m/s^2)", multiline: true },
    ],
    build: (v) => ({
      question: `Write the formula for ${v.name.trim()} and define its variables.`,
      answer: `$${v.formula.trim()}$\n\n${v.meaning.trim()}`,
      tags: ["formula"],
    }),
  },
];

export function getTemplate(id: string): CardTemplate | null {
  return CARD_TEMPLATES.find((t) => t.id === id) ?? null;
}
