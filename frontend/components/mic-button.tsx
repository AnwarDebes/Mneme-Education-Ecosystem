"use client";
import { useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/lib/speech-recognition";

interface MicButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function MicButton({ onTranscript, className }: MicButtonProps) {
  const { supported, listening, transcript, interim, start, stop } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) onTranscript(transcript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  if (!supported) return null;
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant={listening ? "destructive" : "outline"}
        onClick={() => (listening ? stop() : start())}
        title={listening ? "Stop recording" : "Speak your answer"}
        className={className}
      >
        {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
      {interim && (
        <span className="rounded-md bg-secondary px-2 py-1 text-xs italic text-muted-foreground">
          {interim}
        </span>
      )}
    </div>
  );
}
