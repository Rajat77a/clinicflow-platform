let whatsAppWindow: Window | null = null;

export function sendWhatsApp(phone: string, message: string) {
  let digits = phone.replace(/[^0-9]/g, "");
  // If number starts with 0 and has 11 digits (e.g. 09876543210), trim leading 0
  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }
  // If 10-digit number without country code, default to India code '91'
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  if (typeof window !== "undefined") {
    try {
      if (whatsAppWindow && !whatsAppWindow.closed) {
        whatsAppWindow.location.href = url;
        whatsAppWindow.focus();
        return;
      }
    } catch {
      // Cross-origin access or error, fall through to window.open with named window
    }

    try {
      whatsAppWindow = window.open(url, "whatsapp_window");
      if (whatsAppWindow) {
        whatsAppWindow.focus();
        return;
      }
    } catch {
      // Ignore
    }

    // Fallback: programmatic anchor with named target
    const a = document.createElement("a");
    a.href = url;
    a.target = "whatsapp_window";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export interface BillWhatsAppPayload {
  patientName: string;
  invoiceId: string;
  clinicName?: string;
  date: string;
  status: string;
  items?: { category: string; name: string; qty: number; unit: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  amount: number;
  notes?: string;
}

export function formatBillWhatsAppMessage(bill: BillWhatsAppPayload): string {
  const parts: string[] = [
    `Hi ${bill.patientName}, here is the itemized invoice ${bill.invoiceId} from ${bill.clinicName ?? "ClinicFlow"}:`,
    `Date: ${bill.date}\nStatus: ${bill.status}`,
  ];

  if (bill.items && bill.items.length > 0) {
    const itemLines = bill.items.map(
      (item) => `• ${item.name} (${item.category}): ${item.qty} × ₹${item.unit.toFixed(2)} = ₹${(item.qty * item.unit).toFixed(2)}`
    );
    parts.push(`Items Breakdown:\n${itemLines.join("\n")}`);
  }

  const totals = [
    `Subtotal: ₹${bill.subtotal.toFixed(2)}`,
    bill.discount > 0 ? `Discount: -₹${bill.discount.toFixed(2)}` : "",
    bill.tax > 0 ? `Tax: ₹${bill.tax.toFixed(2)}` : "",
    `Total Amount: ₹${bill.amount.toFixed(2)}`,
  ].filter(Boolean);

  parts.push(totals.join("\n"));

  if (bill.notes?.trim()) {
    parts.push(`Notes:\n${bill.notes.trim()}`);
  }

  return parts.join("\n\n");
}
