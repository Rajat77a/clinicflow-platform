export interface ParsedPrescriptionNotes {
  presentingComplaints?: string;
  pastIllnessHistory?: string;
  clinicalFindings?: string;
  treatmentNotes?: string;
  additionalNotes?: string;
}

/**
 * Extracts distinct clinical sections from combined prescription notes,
 * falling back to individual properties if present.
 */
export function parsePrescriptionNotes(notes?: string): ParsedPrescriptionNotes {
  if (!notes) return {};

  const result: ParsedPrescriptionNotes = {};
  const text = notes.trim();

  // Known headers (support both multi-line and single-line/inline separated formats)
  const headers = [
    { key: "presentingComplaints", pattern: /(?:^|\s+)Presenting Complaints:\s*/i },
    { key: "pastIllnessHistory", pattern: /(?:^|\s+)History of Past Illness:\s*/i },
    { key: "clinicalFindings", pattern: /(?:^|\s+)Clinical Findings:\s*/i },
    { key: "treatmentNotes", pattern: /(?:^|\s+)Treatment Notes:\s*/i },
    { key: "additionalNotes", pattern: /(?:^|\s+)Additional Notes:\s*/i },
  ] as const;

  // Find all matches with positions
  const matches: { key: keyof ParsedPrescriptionNotes; start: number; contentStart: number }[] = [];

  for (const h of headers) {
    const match = text.match(h.pattern);
    if (match && match.index !== undefined) {
      matches.push({
        key: h.key,
        start: match.index,
        contentStart: match.index + match[0].length,
      });
    }
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  if (matches.length === 0) {
    result.additionalNotes = text;
    return result;
  }

  // Any text before the first section header is additionalNotes
  if (matches[0].start > 0) {
    const leading = text.slice(0, matches[0].start).trim();
    if (leading) {
      result.additionalNotes = leading;
    }
  }

  // Extract content between headers
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].start : text.length;
    const content = text.slice(current.contentStart, nextStart).trim();
    if (content) {
      result[current.key] = content;
    }
  }

  return result;
}

export function resolvePrescriptionDetails(rx: {
  presentingComplaints?: string;
  pastIllnessHistory?: string;
  clinicalFindings?: string;
  treatmentNotes?: string;
  notes?: string;
  diagnosis: string;
}): {
  presentingComplaints?: string;
  pastIllnessHistory?: string;
  clinicalFindings?: string;
  treatmentNotes?: string;
  additionalNotes?: string;
  primaryIllness: string;
} {
  const parsed = parsePrescriptionNotes(rx.notes);

  const presentingComplaints = rx.presentingComplaints || parsed.presentingComplaints;
  const pastIllnessHistory = rx.pastIllnessHistory || parsed.pastIllnessHistory;
  const clinicalFindings = rx.clinicalFindings || parsed.clinicalFindings;
  const treatmentNotes = rx.treatmentNotes || parsed.treatmentNotes;
  const additionalNotes = parsed.additionalNotes;

  // The primary illness / main reason of the prescription:
  // Use diagnosis if provided, or presenting complaints
  const primaryIllness = rx.diagnosis || presentingComplaints || "General Consultation";

  return {
    presentingComplaints,
    pastIllnessHistory,
    clinicalFindings,
    treatmentNotes,
    additionalNotes,
    primaryIllness,
  };
}

/**
 * Formats any patient ID (UUID or long alphanumeric string) into a clean, friendly short ID like "PT-101".
 * If patient already has a clean short ID (e.g. PT-101 or PT-12) or medical record number, it formats that appropriately.
 */
export function formatPatientId(patientId?: string, medicalRecordNumber?: string): string {
  if (medicalRecordNumber && /^PT-\d+$/i.test(medicalRecordNumber.trim())) {
    return medicalRecordNumber.trim().toUpperCase();
  }

  if (!patientId) return "PT-101";

  const clean = patientId.trim();

  // If already like PT-101 or PT-123
  if (/^PT-\d+$/i.test(clean)) {
    return clean.toUpperCase();
  }

  // If starts with PT- and a short number
  const ptMatch = clean.match(/^PT-(\d+)/i);
  if (ptMatch) {
    return `PT-${ptMatch[1]}`;
  }

  // If it's a medical record number like CF-2026-0000101
  const mrnMatch = (medicalRecordNumber || "").match(/(\d+)$/);
  if (mrnMatch) {
    const num = parseInt(mrnMatch[1], 10);
    if (!isNaN(num) && num > 0) {
      return `PT-${100 + (num % 9000)}`;
    }
  }

  // Derive a deterministic friendly small number 101-999 from UUID/hash
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const smallNum = 101 + (Math.abs(hash) % 899);
  return `PT-${smallNum}`;
}

