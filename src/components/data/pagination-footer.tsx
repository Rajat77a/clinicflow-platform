import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationFooterProps {
  offset: number;
  limit: number;
  total: number;
  onOffsetChange: (offset: number) => void;
  disabled?: boolean;
}

export function PaginationFooter({
  offset,
  limit,
  total,
  onOffsetChange,
  disabled = false,
}: PaginationFooterProps) {
  if (total === 0) return null;
  const first = offset + 1;
  const last = Math.min(offset + limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {first}-{last} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous page"
          title="Previous page"
          disabled={disabled || offset === 0}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next page"
          title="Next page"
          disabled={disabled || offset + limit >= total}
          onClick={() => onOffsetChange(offset + limit)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
