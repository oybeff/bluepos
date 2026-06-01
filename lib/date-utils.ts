/**
 * Uzbek date/number formatting utilities.
 * Replaces toLocaleDateString("uz-UZ") which renders "M05" on Hermes/RN.
 */

const MONTHS_SHORT = ["yan","fev","mar","apr","may","iyn","iyl","avg","sen","okt","noy","dek"];
const MONTHS_FULL = ["yanvar","fevral","mart","aprel","may","iyun","iyul","avgust","sentabr","oktabr","noyabr","dekabr"];
const WEEKDAYS_SHORT = ["Yak","Dush","Sesh","Chor","Pay","Jum","Shan"];
const WEEKDAYS_FULL = ["Yakshanba","Dushanba","Seshanba","Chorshanba","Payshanba","Juma","Shanba"];

function toDate(d: string | Date): Date | null {
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** "7 may" or "7 yanvar 2026" */
export function fmtDate(d: string | Date, opts?: { month?: "short" | "long"; year?: boolean; weekday?: boolean }): string {
  const dt = toDate(d);
  if (!dt) return "";
  const day = dt.getDate();
  const m = opts?.month === "long" ? MONTHS_FULL[dt.getMonth()] : MONTHS_SHORT[dt.getMonth()];
  let s = `${day} ${m}`;
  if (opts?.year) s += ` ${dt.getFullYear()}`;
  if (opts?.weekday) s += `, ${WEEKDAYS_SHORT[dt.getDay()]}`;
  return s;
}

/** "07.05.2026" */
export function fmtDateNum(d: string | Date): string {
  const dt = toDate(d);
  if (!dt) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${dt.getFullYear()}`;
}

/** "07.05.26" */
export function fmtDateNumShort(d: string | Date): string {
  const dt = toDate(d);
  if (!dt) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = String(dt.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

/** "07.05" */
export function fmtDayMonth(d: string | Date): string {
  const dt = toDate(d);
  if (!dt) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

/** "07.05.26 09:35" */
export function fmtDateTime(d: string | Date): string {
  const dt = toDate(d);
  if (!dt) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = String(dt.getFullYear()).slice(-2);
  const hh = String(dt.getHours()).padStart(2, "0");
  const mi = String(dt.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yy} ${hh}:${mi}`;
}

/** "09:35" */
export function fmtTime(d: string | Date): string {
  const dt = toDate(d);
  if (!dt) return "";
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

/** "7-may" — day-month short */
export function fmtDayMonthName(d: string | Date): string {
  const dt = toDate(d);
  if (!dt) return "";
  return `${dt.getDate()}-${MONTHS_SHORT[dt.getMonth()]}`;
}

/** "7 may, Chor" — for dashboard header */
export function fmtDateWeekday(d: string | Date): string {
  const dt = toDate(d);
  if (!dt) return "";
  return `${MONTHS_SHORT[dt.getMonth()]} ${dt.getDate()}, ${WEEKDAYS_SHORT[dt.getDay()]}`;
}

/** "1 234 567" — thousand separator with spaces */
export function fmtNum(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("ru-RU");
}

/** Full weekday + date: "Dushanba, 7 may" */
export function fmtDateFull(d: string | Date): string {
  const dt = toDate(d);
  if (!dt) return "";
  return `${WEEKDAYS_FULL[dt.getDay()]}, ${dt.getDate()} ${MONTHS_FULL[dt.getMonth()]}`;
}

/** "2026-05-07" — ISO date only */
export function fmtISO(d: string | Date): string {
  const dt = toDate(d);
  if (!dt) return "";
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}
