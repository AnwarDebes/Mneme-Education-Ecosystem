"use client";
import { Clock, MoreHorizontal, RotateCcw, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resetCardSchedule, snoozeCard } from "@/lib/snooze";
import { toast } from "sonner";

interface SnoozeMenuProps {
  deckId: string;
  cardId: string;
}

export function SnoozeMenu({ deckId, cardId }: SnoozeMenuProps) {
  const snooze = (days: number, label: string) => {
    snoozeCard(deckId, cardId, days);
    toast.success(`Snoozed ${label}`);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Snooze / schedule">
          <Snowflake className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Snooze this card</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => snooze(1, "1 day")}>
          <Clock className="h-3.5 w-3.5" /> 1 day
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => snooze(3, "3 days")}>
          <Clock className="h-3.5 w-3.5" /> 3 days
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => snooze(7, "a week")}>
          <Clock className="h-3.5 w-3.5" /> 1 week
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => snooze(30, "a month")}>
          <Clock className="h-3.5 w-3.5" /> 1 month
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            resetCardSchedule(deckId, cardId);
            toast.success("Schedule reset; card is due now");
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset (due now)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
