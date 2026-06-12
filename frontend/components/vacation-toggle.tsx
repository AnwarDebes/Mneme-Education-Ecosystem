"use client";
import { useEffect, useState } from "react";
import { Palmtree, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadVacation, setVacationActive } from "@/lib/vacation";
import { useStorageVersion } from "@/lib/hooks";
import { toast } from "sonner";

export function VacationToggle() {
  const version = useStorageVersion();
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(loadVacation().active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={() => {
        const v = setVacationActive(!active);
        setActive(v.active);
        toast.success(v.active ? "Vacation mode on - streak paused" : "Welcome back; streak resumed");
      }}
      title={active ? "Resume normal mode" : "Pause the streak counter without losing it"}
    >
      {active ? <RotateCcw className="h-4 w-4" /> : <Palmtree className="h-4 w-4" />}
      {active ? "End vacation" : "Vacation mode"}
    </Button>
  );
}
