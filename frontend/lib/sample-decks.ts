// Two compact sample decks shipped with the frontend so a fresh user
// has something to study immediately without running the generator.

import type { ParsedCard } from "./import";

export interface SampleDeck {
  id: string;
  name: string;
  topic: string;
  summary: string;
  emoji: string;
  cards: ParsedCard[];
}

export const SAMPLE_DECKS: SampleDeck[] = [
  {
    id: "sample-photosynthesis",
    name: "Photosynthesis (sample)",
    topic: "Biology",
    summary: "Light reactions, Calvin cycle, where it all happens.",
    emoji: "🌱",
    cards: [
      {
        question: "Where do the light-dependent reactions take place?",
        answer: "Thylakoid membranes",
        tags: ["biology", "photosynthesis"],
        difficulty: "easy",
        source_fact: "The light-dependent reactions occur in the thylakoid membranes of the chloroplast.",
      },
      {
        question: "What pigment do chloroplasts contain?",
        answer: "Chlorophyll",
        tags: ["biology", "photosynthesis"],
        difficulty: "easy",
      },
      {
        question: "How many CO2 molecules are used per glucose molecule?",
        answer: "Six",
        tags: ["biology", "photosynthesis"],
        difficulty: "easy",
      },
      {
        question: "Why does the Calvin cycle depend on the light-dependent reactions?",
        answer:
          "It needs the ATP and NADPH produced by the light-dependent reactions to fix carbon dioxide.",
        tags: ["biology", "photosynthesis"],
        difficulty: "hard",
      },
      {
        question: "What overall input does photosynthesis convert into chemical energy?",
        answer: "Sunlight (light energy)",
        tags: ["biology", "photosynthesis"],
        difficulty: "easy",
      },
      {
        question: "Which gas is released by photosynthesis as a byproduct?",
        answer: "Oxygen (O2)",
        tags: ["biology", "photosynthesis"],
        difficulty: "easy",
      },
      {
        question: "What two molecules transfer energy from the light reactions to the Calvin cycle?",
        answer: "ATP and NADPH",
        tags: ["biology", "photosynthesis"],
        difficulty: "medium",
      },
      {
        question: "Which enzyme catalyzes the first step of carbon fixation in the Calvin cycle?",
        answer: "RuBisCO",
        tags: ["biology", "photosynthesis"],
        difficulty: "medium",
      },
    ],
  },
  {
    id: "sample-css",
    name: "CSS basics (sample)",
    topic: "Web dev",
    summary: "Box model, selectors, flex/grid quick refresher.",
    emoji: "🎨",
    cards: [
      {
        question: "Which CSS property sets the space inside an element's border?",
        answer: "padding",
        tags: ["css", "web"],
        difficulty: "easy",
      },
      {
        question: "Which CSS property sets the space outside an element's border?",
        answer: "margin",
        tags: ["css", "web"],
        difficulty: "easy",
      },
      {
        question: "What CSS unit is relative to the root element's font size?",
        answer: "rem",
        tags: ["css", "web"],
        difficulty: "easy",
      },
      {
        question: "In Flexbox, which property controls the layout direction?",
        answer: "flex-direction",
        tags: ["css", "flexbox", "web"],
        difficulty: "medium",
      },
      {
        question: "In CSS Grid, what property defines the columns of the grid?",
        answer: "grid-template-columns",
        tags: ["css", "grid", "web"],
        difficulty: "medium",
      },
      {
        question: "Which pseudo-class targets an element on mouse hover?",
        answer: ":hover",
        tags: ["css", "web"],
        difficulty: "easy",
      },
      {
        question: "What does the CSS specificity (0,1,1,0) come from?",
        answer: "One ID selector and one class selector",
        tags: ["css", "web"],
        difficulty: "hard",
      },
    ],
  },
];

export function findSample(id: string): SampleDeck | null {
  return SAMPLE_DECKS.find((d) => d.id === id) ?? null;
}
