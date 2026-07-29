export type BackendErrorCode =
  | "access_denied"
  | "conflict"
  | "invalid_request"
  | "not_found"
  | "service_unavailable"
  | "unknown";

type BackendErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

const SAFE_MESSAGE_PATTERNS: ReadonlyArray<RegExp> = [
  /^A clinic workspace is required$/,
  /^An account or invitation already exists/,
  /^Appointment not found$/,
  /^Create an active facility/,
  /^Doctor is not active/,
  /^Invalid (?:facility|department|invitation redirect)/,
  /^Invoice (?:database identifier is missing|not found)/,
  /^Patient record not found$/,
  /^Saved record is not visible/,
  /^Signed prescriptions are immutable/,
  /^The active hospital could not be loaded$/,
  /^The invitation service returned an invalid response$/,
  /^Two-step verification is required$/,
  /^Use the payment workflow/,
  /^Version conflict/,
  /^You (?:cannot|do not have permission)/,
];

function isSafeMessage(message: string) {
  return SAFE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

function classify(error: BackendErrorLike): BackendErrorCode {
  if (error.status === 401 || error.status === 403 || error.code === "42501") {
    return "access_denied";
  }
  if (
    error.status === 409 ||
    error.code === "23505" ||
    error.code === "23P01" ||
    error.message?.toLowerCase().includes("version conflict")
  ) {
    return "conflict";
  }
  if (
    error.status === 400 ||
    error.status === 422 ||
    error.code === "22023" ||
    error.code === "23514"
  ) {
    return "invalid_request";
  }
  if (error.status === 404 || error.code === "PGRST116") return "not_found";
  if (
    error.status === 429 ||
    (error.status != null && error.status >= 500) ||
    error.message?.toLowerCase().includes("failed to fetch")
  ) {
    return "service_unavailable";
  }
  return "unknown";
}

function defaultMessage(code: BackendErrorCode) {
  switch (code) {
    case "access_denied":
      return "You do not have permission to perform this operation";
    case "conflict":
      return "This record changed or conflicts with an existing record";
    case "invalid_request":
      return "The submitted information is invalid";
    case "not_found":
      return "The requested record was not found";
    case "service_unavailable":
      return "The hospital service is temporarily unavailable";
    default:
      return "Unable to complete the operation";
  }
}

export class SafeBackendError extends Error {
  readonly code: BackendErrorCode;
  readonly requestId?: string;

  constructor(
    code: BackendErrorCode,
    message = defaultMessage(code),
    requestId?: string,
  ) {
    super(message);
    this.name = "SafeBackendError";
    this.code = code;
    this.requestId = requestId;
  }
}

export function toSafeBackendError(error: unknown, fallback?: string) {
  if (error instanceof SafeBackendError) return error;
  const candidate =
    error && typeof error === "object" ? (error as BackendErrorLike) : {};
  const code = classify(candidate);
  const rawMessage = typeof candidate.message === "string" ? candidate.message.trim() : "";
  const message = rawMessage && isSafeMessage(rawMessage)
    ? rawMessage
    : fallback || defaultMessage(code);
  return new SafeBackendError(code, message);
}
