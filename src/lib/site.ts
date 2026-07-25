export const SITE_URL = "https://clinicflow-platform.vercel.app";

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}
