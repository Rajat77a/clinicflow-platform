export function detectMime(bytes: Buffer): "application/pdf" | "image/jpeg" | "image/png" | null;

export function parseClamdResponse(value: string): {
  clean: boolean;
  detailCode: "clean" | "malware_detected";
};
