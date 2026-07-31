import { SafeBackendError, toSafeBackendError } from "../backend/safe-error.ts";

export type FunctionInvokeError = {
  message: string;
  context?: Response;
} & Record<string, unknown>;

export async function throwIfFunctionError(error: FunctionInvokeError | null) {
  if (!error) return;
  if (error.context instanceof Response) {
    let body: { error?: unknown; code?: unknown; requestId?: unknown } | null = null;
    try {
      body = await error.context.clone().json() as { error?: unknown };
    } catch {
      // Fall through to the Supabase client message when the response is not JSON.
    }
    if (typeof body?.error === "string" && body.error.trim()) {
      const safe = toSafeBackendError({
        message: body.error,
        status: error.context.status,
      });
      throw new SafeBackendError(
        safe.code,
        safe.message,
        typeof body.requestId === "string" ? body.requestId : undefined,
      );
    }
  }
  throw toSafeBackendError(error, "Unable to contact the hospital service");
}
