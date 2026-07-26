import type { RecordPage, RecordPageInput } from "./backend/workspace-repository";

export function normalizePageInput(input: RecordPageInput) {
  return {
    limit: Math.min(Math.max(input.limit ?? 25, 1), 100),
    offset: Math.max(input.offset ?? 0, 0),
  };
}

export function localRecordPage<T>(
  rows: T[],
  input: RecordPageInput,
): RecordPage<T> {
  const { limit, offset } = normalizePageInput(input);
  return {
    rows: rows.slice(offset, offset + limit),
    total: rows.length,
    limit,
    offset,
  };
}
