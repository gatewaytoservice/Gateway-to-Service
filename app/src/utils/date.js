// src/utils/date.js

export function getUpcomingFridayISO(now = new Date()) {
  // ISO date in local time (YYYY-MM-DD)
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  // JS: Sunday=0 ... Friday=5
  const day = d.getDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  d.setDate(d.getDate() + daysUntilFriday);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatFriendlyDate(iso) {
  // iso: YYYY-MM-DD
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
