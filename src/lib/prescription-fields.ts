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
