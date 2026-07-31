import assert from "node:assert/strict";
import test from "node:test";
import { throwIfFunctionError } from "./supabase/function-error.ts";

test("function errors expose the safe backend reason", async () => {
  await assert.rejects(
    throwIfFunctionError({
      message: "Edge Function returned a non-2xx status code",
      context: new Response(JSON.stringify({ error: "Create an active facility first" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    }),
    /Create an active facility first/,
  );
});

test("function errors fall back when the response is not JSON", async () => {
  await assert.rejects(
    throwIfFunctionError({
      message: "Failed to send a request to the Edge Function",
      context: new Response("upstream unavailable", { status: 503 }),
    }),
    /Unable to contact the hospital service/,
  );
});
