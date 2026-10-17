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
  // If diagnosis is missing or "Not recorded", use presenting complaints instead of showing "Not recorded"
  const cleanDiagnosis = rx.diagnosis && rx.diagnosis.trim().toLowerCase() !== "not recorded" ? rx.diagnosis.trim() : "";
  const primaryIllness = cleanDiagnosis || presentingComplaints || "General Consultation";

  return {
    presentingComplaints,
    pastIllnessHistory,
    clinicalFindings,
    treatmentNotes,
    additionalNotes,
    primaryIllness,
  };
}

export interface ClinicLookupItem {
  id: string;
  shortId?: string;
  name?: string;
}

/**
 * Clean clinic hint helper: converts a clinicId, clinic shortId, or hospital UUID
 * into a clean standard token like "CL-101" or "CL-001".
 */
export function formatClinicCode(clinicHint?: string | null): string {
  if (!clinicHint) return "";
  const clean = clinicHint.trim();
  const clMatch = clean.match(/^CL-?(\d+)/i);
  if (clMatch) {
    return `CL-${clMatch[1]}`;
  }
  // If it's a UUID or custom id, hash it deterministically to 101-999
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const num = 101 + (Math.abs(hash) % 899);
  return `CL-${num}`;
}

/**
 * Authoritative clinic code resolver:
 * Matches against a list of clinics by id, shortId, or name,
 * returning the canonical shortId (e.g., "CL-101") so that
 * the same clinic never has conflicting codes across different screens or entities.
 */
export function resolveClinicCode(
  clinicHint?: string | null,
  clinics?: ClinicLookupItem[] | null,
  fallbackClinicHint?: string | null,
): string {
  const primary = (clinicHint || "").trim();
  const fallback = (fallbackClinicHint || "").trim();

  // If clinics list provided, search for matching clinic
  if (clinics && clinics.length > 0) {
    if (primary) {
      const match = clinics.find(
        (c) =>
          c.id === primary ||
          (c.shortId && c.shortId.toLowerCase() === primary.toLowerCase()) ||
          (c.name && c.name.toLowerCase() === primary.toLowerCase()),
      );
      if (match?.shortId) {
        return formatClinicCode(match.shortId);
      }
    }
    if (fallback) {
      const matchFallback = clinics.find(
        (c) =>
          c.id === fallback ||
          (c.shortId && c.shortId.toLowerCase() === fallback.toLowerCase()) ||
          (c.name && c.name.toLowerCase() === fallback.toLowerCase()),
      );
      if (matchFallback?.shortId) {
        return formatClinicCode(matchFallback.shortId);
      }
    }
  }

  // Next, if primary has an explicit CL-xxx pattern
  if (primary) {
    const clMatch = primary.match(/^CL-?(\d+)/i);
    if (clMatch) return `CL-${clMatch[1]}`;
  }
  if (fallback) {
    const clMatch = fallback.match(/^CL-?(\d+)/i);
    if (clMatch) return `CL-${clMatch[1]}`;
  }

  // Fallback to formatClinicCode
  return formatClinicCode(primary || fallback);
}

/**
 * Universal formatter that creates unified clinic-linked entity identifiers:
 * e.g. "CL-101-PT-101", "CL-101-DR-102", "CL-101-AP-101", "CL-101-LB-101", "CL-101-RX-101", "CL-101-INV-101"
 */
export function formatClinicEntityId(
  typePrefix: "PT" | "DR" | "RC" | "CA" | "SA" | "ST" | "RX" | "INV" | "AP" | "LB",
  rawId?: string | null,
  clinicHint?: string | null,
  mrnHint?: string | null,
): string {
  const clinicPrefix = formatClinicCode(clinicHint);
  const clean = (rawId || mrnHint || "").trim();

  // If already full compound ID like CL-101-PT-105 or CL-183-DR-101
  const fullMatch = clean.match(/^(CL-\d+)-([A-Z]{2})-(\d+)$/i);
  if (fullMatch) {
    if (clinicPrefix && fullMatch[1].toUpperCase() !== clinicPrefix.toUpperCase()) {
      // Re-link with the authoritative clinic prefix for consistency across views
      return `${clinicPrefix}-${fullMatch[2].toUpperCase()}-${fullMatch[3]}`;
    }
    return `${fullMatch[1].toUpperCase()}-${fullMatch[2].toUpperCase()}-${fullMatch[3]}`;
  }

  // Extract short number if already has type prefix like PT-101, DR-102, AP-105, LB-101, INV-2026-101
  let subNum = 101;
  const numMatch = clean.match(/(\d+)$/);
  if (numMatch) {
    const parsed = parseInt(numMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      subNum = parsed < 100 ? 100 + parsed : (parsed % 9000);
    }
  } else if (clean) {
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = (hash << 5) - hash + clean.charCodeAt(i);
      hash |= 0;
    }
    subNum = 101 + (Math.abs(hash) % 899);
  }

  const baseEntityId = `${typePrefix}-${subNum}`;
  return clinicPrefix ? `${clinicPrefix}-${baseEntityId}` : baseEntityId;
}

/**
 * Formats any patient ID into a clean, friendly short ID like "PT-101",
 * or clinic-connected ID like "CL-101-PT-101" when clinic hint is available.
 */
export function formatPatientId(patientId?: string, medicalRecordNumber?: string, clinicHint?: string | null): string {
  if (clinicHint) {
    return formatClinicEntityId("PT", patientId, clinicHint, medicalRecordNumber);
  }

  if (medicalRecordNumber && /^PT-\d+$/i.test(medicalRecordNumber.trim())) {
    return medicalRecordNumber.trim().toUpperCase();
  }

  if (!patientId) return "PT-101";

  const clean = patientId.trim();

  // If already like CL-101-PT-123
  if (/^CL-\d+-PT-\d+$/i.test(clean)) {
    return clean.toUpperCase();
  }

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

export function formatPrescriptionId(rxId?: string | null, clinicHint?: string | null): string {
  if (!rxId) return "RX-101";
  const clean = rxId.trim();
  if (/^CL-\d+-RX-\d+$/i.test(clean) && !clinicHint) return clean.toUpperCase();
  if (/^RX-\d+$/i.test(clean) && !clinicHint) return clean.toUpperCase();
  return formatClinicEntityId("RX", clean, clinicHint);
}

export function formatInvoiceId(invoiceId?: string | null, clinicHint?: string | null): string {
  if (!invoiceId) return "INV-101";
  const clean = invoiceId.trim();
  if (/^CL-\d+-INV-\d+$/i.test(clean) && !clinicHint) return clean.toUpperCase();
  if (/^INV-\d+$/i.test(clean) && !clinicHint) return clean.toUpperCase();
  return formatClinicEntityId("INV", clean, clinicHint);
}

export function formatAppointmentId(aptId?: string | null, clinicHint?: string | null): string {
  if (!aptId) return "AP-101";
  const clean = aptId.trim();
  if (/^CL-\d+-AP-\d+$/i.test(clean) && !clinicHint) return clean.toUpperCase();
  if (/^AP-\d+$/i.test(clean) && !clinicHint) return clean.toUpperCase();
  return formatClinicEntityId("AP", clean, clinicHint);
}

export function formatDoctorId(doctorId?: string | null, clinicHint?: string | null): string {
  if (!doctorId) return "DR-101";
  const clean = doctorId.trim();
  if (/^CL-\d+-DR-\d+$/i.test(clean) && !clinicHint) return clean.toUpperCase();
  if (/^DR-\d+$/i.test(clean) && !clinicHint) return clean.toUpperCase();
  return formatClinicEntityId("DR", clean, clinicHint);
}

export function formatLabReportId(labId?: string | null, clinicHint?: string | null): string {
  if (!labId) return "LB-101";
  const clean = labId.trim();
  if (/^CL-\d+-LB-\d+$/i.test(clean) && !clinicHint) return clean.toUpperCase();
  if (/^LB-\d+$/i.test(clean) && !clinicHint) return clean.toUpperCase();
  return formatClinicEntityId("LB", clean, clinicHint);
}


