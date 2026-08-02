import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TimeWheelPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

function parseTime(value: string) {
  const [rawHour = "0", rawMinute = "0"] = value.split(":");
  const hour24 = Math.min(Math.max(Number(rawHour) || 0, 0), 23);
  const minute = Math.min(Math.max(Number(rawMinute) || 0, 0), 59);
  return {
    hour: hour24 % 12 || 12,
    minute,
    period: hour24 >= 12 ? "PM" : "AM",
  } as const;
}

function toTime(hour: number, minute: number, period: "AM" | "PM") {
  const hour24 = (hour % 12) + (period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function displayTime(value: string) {
  const { hour, minute, period } = parseTime(value);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

interface WheelProps<T extends string | number> {
  label: string;
  options: readonly T[];
  selected: T;
  format?: (value: T) => string;
  onSelect: (value: T) => void;
}

function TimeWheel<T extends string | number>({ label, options, selected, format, onSelect }: WheelProps<T>) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div
        className="h-36 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-md py-12 [perspective:420px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label={label}
      >
        {options.map((option) => {
          const active = option === selected;
          return (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={active}
              data-wheel-selected={active ? "true" : undefined}
              className={cn(
                "mx-auto flex h-9 w-14 snap-center items-center justify-center rounded-md text-sm tabular-nums transition-[transform,color,background-color,opacity] duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none",
                active
                  ? "bg-primary text-primary-foreground shadow-md [transform:translateZ(34px)_scale(1.06)]"
                  : "text-muted-foreground opacity-65 hover:bg-muted hover:text-foreground [transform:translateZ(-30px)_scale(.88)]",
              )}
              onClick={() => onSelect(option)}
            >
              {format ? format(option) : option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimeWheelPicker({ value, onChange, disabled, className, "aria-label": ariaLabel }: TimeWheelPickerProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const parsed = parseTime(value);
  const hours = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, index) => index), []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      contentRef.current?.querySelectorAll<HTMLElement>('[data-wheel-selected="true"]').forEach((option) => {
        option.scrollIntoView({ block: "center" });
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel ?? `Choose time, currently ${displayTime(value)}`}
          className={cn("h-11 w-full justify-start rounded-xl px-3 font-normal", className)}
        >
          <Clock3 className="mr-2 h-4 w-4 text-primary" aria-hidden="true" />
          <span className="tabular-nums">{displayTime(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent ref={contentRef} align="start" className="w-72 p-3">
        <div className="relative flex gap-2 overflow-hidden rounded-lg bg-muted/30 p-2">
          <div className="pointer-events-none absolute inset-x-2 top-1/2 h-9 -translate-y-1/2 rounded-md border border-primary/25 bg-background/35" />
          <TimeWheel
            label="Hour"
            options={hours}
            selected={parsed.hour}
            format={(hour) => String(hour).padStart(2, "0")}
            onSelect={(hour) => onChange(toTime(hour, parsed.minute, parsed.period))}
          />
          <TimeWheel
            label="Minute"
            options={minutes}
            selected={parsed.minute}
            format={(minute) => String(minute).padStart(2, "0")}
            onSelect={(minute) => onChange(toTime(parsed.hour, minute, parsed.period))}
          />
          <TimeWheel
            label="Period"
            options={["AM", "PM"] as const}
            selected={parsed.period}
            onSelect={(period) => onChange(toTime(parsed.hour, parsed.minute, period))}
          />
        </div>
        <div className="mt-2 text-center text-xs text-muted-foreground">Selected {displayTime(value)}</div>
      </PopoverContent>
    </Popover>
  );
}
