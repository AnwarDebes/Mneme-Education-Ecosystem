"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { speechRecognitionAvailable } from "@/lib/speech-recognition";
import { toast } from "sonner";

type Recognition = any;

interface Command {
  patterns: RegExp[];
  description: string;
  run: (router: ReturnType<typeof useRouter>, match: RegExpMatchArray) => void;
}

const COMMANDS: Command[] = [
  {
    patterns: [/(?:open|go to|show) (?:my )?library/i],
    description: "Open library",
    run: (r) => r.push("/library" as any),
  },
  {
    patterns: [/(?:open|go to|show) today/i],
    description: "Open today",
    run: (r) => r.push("/today" as any),
  },
  {
    patterns: [/(?:open|show) insights/i, /(?:open|show) (?:my )?stats/i],
    description: "Insights",
    run: (r) => r.push("/insights" as any),
  },
  {
    patterns: [/(?:open|show) mistakes/i, /(?:open|show) (?:my )?errors/i, /(?:my )?error book/i],
    description: "Error book",
    run: (r) => r.push("/mistakes" as any),
  },
  {
    patterns: [/(?:open|show) search/i, /search/i],
    description: "Search",
    run: (r) => r.push("/search" as any),
  },
  {
    patterns: [/(?:open|show) learn/i, /memory science/i],
    description: "Learn",
    run: (r) => r.push("/learn" as any),
  },
  {
    patterns: [/(?:start )?study/i, /let'?s study/i],
    description: "Pick a deck to study",
    run: (r) => r.push("/study" as any),
  },
  {
    patterns: [/generate/i, /new deck/i, /create a deck/i],
    description: "Generate a deck",
    run: (r) => r.push("/generator" as any),
  },
  {
    patterns: [/import/i],
    description: "Import a deck",
    run: (r) => r.push("/import" as any),
  },
  {
    patterns: [/feed/i, /(?:my )?review feed/i],
    description: "Review feed",
    run: (r) => r.push("/feed" as any),
  },
  {
    patterns: [/showcase/i, /demo/i, /tour/i],
    description: "Showcase",
    run: (r) => r.push("/showcase" as any),
  },
  {
    patterns: [/duplicates?/i, /find dup/i],
    description: "Duplicate finder",
    run: (r) => r.push("/duplicates" as any),
  },
  {
    patterns: [/cards/i, /all cards/i],
    description: "All cards",
    run: (r) => r.push("/cards" as any),
  },
  {
    patterns: [/compare/i],
    description: "Compare decks",
    run: (r) => r.push("/compare" as any),
  },
  {
    patterns: [/help/i],
    description: "Help",
    run: (r) => r.push("/help" as any),
  },
  {
    patterns: [/(?:from|scan|read) (?:an? )?image/i, /vision/i, /ocr/i],
    description: "Image to cards (vision)",
    run: (r) => {
      r.push("/library" as any);
      setTimeout(() => window.dispatchEvent(new Event("mneme:open-vision")), 200);
    },
  },
];

export function VoiceCommandToggle() {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [last, setLast] = useState<string>("");
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported(speechRecognitionAvailable());
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const start = () => {
    if (!speechRecognitionAvailable()) return;
    const Ctor = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    rec.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript ?? "";
      setLast(text);
      for (const cmd of COMMANDS) {
        for (const pat of cmd.patterns) {
          const m = text.match(pat);
          if (m) {
            toast.success(`Heard: "${text}"`, { description: cmd.description });
            cmd.run(router, m);
            return;
          }
        }
      }
      toast.warning(`Didn't understand: "${text}"`, {
        description: "Try: open library, show insights, start study, generate a deck",
      });
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  if (!supported) return null;

  return (
    <>
      <Button
        variant={listening ? "default" : "ghost"}
        size="icon"
        onClick={() => (listening ? recRef.current?.stop() : start())}
        title={listening ? "Listening..." : "Voice command"}
      >
        {listening ? <Mic className="h-4 w-4 animate-pulse" /> : <MicOff className="h-4 w-4" />}
      </Button>
      <AnimatePresence>
        {listening && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2"
          >
            <Badge className="bg-primary px-4 py-2 text-sm shadow-lg">
              <Mic className="h-4 w-4 animate-pulse" /> Listening for a command...
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
