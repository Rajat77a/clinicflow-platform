export const STORAGE_KEY_INVOICE_NOTES = "cf_invoice_notes";

export function loadInvoiceNotesFromStorage(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INVOICE_NOTES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveInvoiceNoteToStorage(billId: string, note: string): void {
  if (typeof window === "undefined") return;
  try {
    const notes = loadInvoiceNotesFromStorage();
    if (note && note.trim()) {
      notes[billId] = note.trim();
    } else {
      delete notes[billId];
    }
    localStorage.setItem(STORAGE_KEY_INVOICE_NOTES, JSON.stringify(notes));
  } catch {
    // Ignore quota or disabled storage
  }
}
