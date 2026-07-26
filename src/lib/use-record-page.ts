import { useEffect, useState } from "react";
import type { RecordPage, RecordPageInput } from "./backend/workspace-repository";

export function useRecordPage<T>(
  loader: (input?: RecordPageInput) => Promise<RecordPage<T>>,
  input: Omit<RecordPageInput, "offset" | "limit"> = {},
  limit = 25,
) {
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<RecordPage<T>>({
    rows: [],
    total: 0,
    limit,
    offset: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const query = input.query ?? "";
  const patientId = input.patientId;

  useEffect(() => {
    setOffset(0);
  }, [query, patientId]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void loader({ query, patientId, limit, offset })
      .then((result) => {
        if (active) setPage(result);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Unable to load records");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [limit, loader, offset, patientId, query]);

  return { ...page, offset, setOffset, isLoading, error };
}
