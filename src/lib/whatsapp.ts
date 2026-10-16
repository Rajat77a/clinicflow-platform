// WhatsApp share helper - opens wa.me deep link with pre-filled message
export function sendWhatsApp(phone: string, message: string) {
  let digits = phone.replace(/[^0-9]/g, "");
  // If 10-digit number without country code, default to India code '91'
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
