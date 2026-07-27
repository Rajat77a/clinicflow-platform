export type FunctionInvokeError = {
  message: string;
  context?: Response;
} & Record<string, unknown>;

export async function throwIfFunctionError(error: FunctionInvokeError | null) {
  if (!error) return;
  if (error.context instanceof Response) {
    let body: { error?: unknown } | null = null;
    try {
      body = await error.context.clone().json() as { error?: unknown };
    } catch {
      // Fall through to the Supabase client message when the response is not JSON.
    }
    if (typeof body?.error === "string" && body.error.trim()) {
      throw new Error(body.error);
    }
  }
  throw new Error(error.message);
}
