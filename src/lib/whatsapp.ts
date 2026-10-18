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
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
}
