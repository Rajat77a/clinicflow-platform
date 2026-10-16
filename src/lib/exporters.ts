import DOMPurify from "dompurify";

// Lightweight client-side CSV export helpers
export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set<string>())
  );
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s.trimStart())) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
}

export function downloadFile(filename: string, content: string, mime = "text/csv;charset=utf-8;") {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  downloadFile(filename, toCSV(rows));
}

const PRINT_TAGS = new Set(["B", "BODY", "BR", "DIV", "H1", "H2", "H3", "P", "SPAN", "TABLE", "TBODY", "TD", "TH", "THEAD", "TR"]);
const PRINT_CLASSES = new Set(["card", "muted", "row", "total", "section", "label", "val"]);

function sanitizePrintContent(html: string) {
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: Array.from(PRINT_TAGS, tag => tag.toLowerCase()),
    ALLOWED_ATTR: ["class"],
    RETURN_DOM_FRAGMENT: true,
  });
  Array.from(fragment.querySelectorAll("*")).forEach(element => {
    const classes = Array.from(element.classList).filter(className => PRINT_CLASSES.has(className));
    if (classes.length) {
      element.className = classes.join(" ");
    } else {
      element.removeAttribute("class");
    }
  });
  return fragment;
}

export function printDocument(html: string, title = "ClinicFlow") {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  const safeContent = sanitizePrintContent(html);
  const style = w.document.createElement("style");
  style.textContent = `
    @page { margin: 15mm 20mm; size: auto; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      padding: 24px;
      color: #0f172a;
      line-height: 1.5;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3 { margin: 0 0 6px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
    h2 { font-size: 22px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    h3 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #334155; margin-top: 24px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .muted { color: #64748b; font-size: 12px; margin-bottom: 12px; }
    .card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 18px 20px;
      margin-top: 14px;
      background: #f8fafc;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      font-size: 13px;
      border-bottom: 1px dotted #e2e8f0;
    }
    .row:last-child { border-bottom: none; }
    .row b { color: #334155; font-weight: 600; min-width: 140px; }
    .row span { color: #0f172a; font-weight: 500; text-align: right; }
    .section {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }
    .label {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 4px;
    }
    .val {
      font-size: 13.5px;
      color: #0f172a;
      white-space: pre-wrap;
      line-height: 1.5;
      font-weight: 500;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    th {
      font-weight: 700;
      color: #1e293b;
      background: #f1f5f9;
      padding: 10px 12px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 2px solid #cbd5e1;
      text-align: left;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
      color: #0f172a;
    }
    tr:nth-child(even) td { background: #fafafa; }
    .total {
      font-weight: 700;
      font-size: 18px;
      border-top: 2px solid #0f172a;
      padding-top: 10px;
      margin-top: 12px;
    }
  `;
  w.document.title = title;
  w.document.head.appendChild(style);
  w.document.body.appendChild(w.document.importNode(safeContent, true));
  w.addEventListener("load", () => w.print(), { once: true });
  w.document.close();
}
