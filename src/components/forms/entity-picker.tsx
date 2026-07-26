import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface EntityOption {
  id: string;
  primary: string;        // e.g. "John Mathew"
  secondary?: string;     // e.g. "34 M"
  tertiary?: string;      // e.g. "9876543210"
  searchTokens: string[]; // lowercased searchable strings (id, name, phone, etc.)
  raw?: unknown;
}

interface Props<T extends EntityOption> {
  options: T[];
  onSearch?: (query: string) => Promise<T[]>;
  value: T | null;
  onChange: (v: T | null) => void;
  placeholder?: string;
  emptyText?: string;
  labelId?: string;
  className?: string;
}

export function EntityPicker<T extends EntityOption>({
  options, onSearch, value, onChange, placeholder = "Type ID, name or phone…",
  emptyText = "No matches", labelId, className,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [remoteResults, setRemoteResults] = useState<T[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (!onSearch || normalized.length < 2) {
      setRemoteResults(null);
      setIsSearching(false);
      return;
    }

    let current = true;
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      void onSearch(normalized)
        .then((rows) => {
          if (current) setRemoteResults(rows);
        })
        .catch(() => {
          if (current) setRemoteResults([]);
        })
        .finally(() => {
          if (current) setIsSearching(false);
        });
    }, 250);

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [onSearch, query]);

  const results = useMemo(() => {
    if (remoteResults) return remoteResults.slice(0, 12);
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options.filter(o => o.searchTokens.some(t => t.includes(q))).slice(0, 12);
  }, [options, query, remoteResults]);

  useEffect(() => { setActive(0); }, [query]);

  const pick = (o: T) => {
    onChange(o);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {value ? (
        <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{value.primary}</div>
            <div className="truncate text-xs text-muted-foreground">
              <span className="font-mono">{value.id}</span>
              {value.secondary ? <> · {value.secondary}</> : null}
              {value.tertiary ? <> · {value.tertiary}</> : null}
            </div>
          </div>
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => onChange(null)}
            className="ml-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-labelledby={labelId}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
              else if (e.key === "Enter" && open && results[active]) { e.preventDefault(); pick(results[active]); }
              else if (e.key === "Escape") setOpen(false);
            }}
            placeholder={placeholder}
            className="h-11 rounded-xl pl-9"
          />
        </div>
      )}

      {open && !value && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-lg">
          {isSearching ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            results.map((o, i) => (
              <button
                type="button"
                key={o.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                  i === active ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{o.primary}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{o.id}</span>
                    {o.secondary ? <> · {o.secondary}</> : null}
                    {o.tertiary ? <> · {o.tertiary}</> : null}
                  </div>
                </div>
                {i === active && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ----- Workspace adapters -----
import type { Doctor, Patient } from "@/lib/workspace-data";

export type PatientOption = EntityOption & { raw: Patient };
export type DoctorOption = EntityOption & { raw: Doctor };

export const toPatientOptions = (patients: Patient[]): PatientOption[] => patients.map(p => ({
  id: p.id,
  primary: p.name,
  secondary: `${p.age} ${p.gender[0]}`,
  tertiary: p.phone,
  searchTokens: [p.id.toLowerCase(), p.name.toLowerCase(), p.phone.replace(/\s/g, "")],
  raw: p,
}));

export const toDoctorOptions = (doctors: Doctor[]): DoctorOption[] => doctors.map(d => ({
  id: d.id,
  primary: d.name,
  secondary: d.specialty,
  tertiary: d.phone,
  searchTokens: [d.id.toLowerCase(), d.name.toLowerCase(), d.phone.replace(/\s/g, "")],
  raw: d,
}));
