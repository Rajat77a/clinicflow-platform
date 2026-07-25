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
const PRINT_CLASSES = new Set(["card", "muted", "row", "total"]);

function sanitizePrintHtml(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script,style,iframe,object,embed").forEach(element => element.remove());
  Array.from(parsed.body.querySelectorAll("*")).forEach(element => {
    if (!PRINT_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }
    const classes = Array.from(element.classList).filter(className => PRINT_CLASSES.has(className));
    Array.from(element.attributes).forEach(attribute => element.removeAttribute(attribute.name));
    if (classes.length) element.className = classes.join(" ");
  });
  return parsed.body.innerHTML;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function printDocument(html: string, title = "ClinicFlow") {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  const safeHtml = sanitizePrintHtml(html);
  const safeTitle = escapeHtml(title);
  w.document.write(`<!doctype html><html><head><title>${safeTitle}</title>
    <style>
      body{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;padding:32px;color:#0f172a}
      h1,h2,h3{margin:0 0 8px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      td,th{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:14px}
      .muted{color:#64748b;font-size:12px}
      .row{display:flex;justify-content:space-between;margin:4px 0}
      .card{border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-top:12px}
      .total{font-weight:700;font-size:18px;border-top:2px solid #0f172a;padding-top:8px;margin-top:8px}
    </style></head><body>${safeHtml}
    <script>window.onload=()=>{window.print()}</script>
    </body></html>`);
  w.document.close();
}
