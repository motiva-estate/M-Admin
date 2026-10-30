// Helpers shared by the receipt editor live preview and other receipt UI.
//
// The Naira-words logic mirrors the backend PdfGeneratorService.numberToWords
// so the on-screen preview matches the generated PDF exactly.

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const TEENS = [
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function convert(n: number): string {
  if (n === 0) return "";
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const one = n % 10;
    return TENS[ten] + (one > 0 ? " " + ONES[one] : "");
  }
  if (n < 1000) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    return ONES[hundred] + " Hundred" + (rest > 0 ? " and " + convert(rest) : "");
  }
  if (n < 1_000_000) {
    const thousand = Math.floor(n / 1000);
    const rest = n % 1000;
    return (
      convert(thousand) +
      " Thousand" +
      (rest > 0 ? (rest < 100 ? " and " : ", ") + convert(rest) : "")
    );
  }
  if (n < 1_000_000_000) {
    const million = Math.floor(n / 1_000_000);
    const rest = n % 1_000_000;
    return (
      convert(million) +
      " Million" +
      (rest > 0 ? (rest < 100 ? " and " : ", ") + convert(rest) : "")
    );
  }
  const billion = Math.floor(n / 1_000_000_000);
  const rest = n % 1_000_000_000;
  return (
    convert(billion) + " Billion" + (rest > 0 ? (rest < 100 ? " and " : ", ") + convert(rest) : "")
  );
}

/** Convert a Naira amount to words, e.g. 125000 -> "One Hundred and Twenty Five Thousand Naira Only". */
export function numberToWords(num: number): string {
  const safe = Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
  if (safe === 0) return "Zero Naira Only";

  const nairaInt = Math.floor(safe);
  const kobo = Math.round((safe - nairaInt) * 100);

  let result = convert(nairaInt) + " Naira";
  if (kobo > 0) result += ", " + convert(kobo) + " Kobo";
  return result + " Only";
}

/** Format a Naira amount with thousands separators and 2 decimals: 125000 -> "125,000.00". */
export function formatNaira(n: number): string {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Today's date as DD-MM-YYYY (the format the receipts API stores/displays). */
export function todayDmY(): string {
  return new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
}

/** Convert DD-MM-YYYY -> YYYY-MM-DD so it can drive an <input type="date">. */
export function dmYToIso(d: string): string {
  const [dd, mm, yyyy] = (d || "").split("-");
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert a YYYY-MM-DD value from <input type="date"> back to DD-MM-YYYY. */
export function isoToDmY(d: string): string {
  const [yyyy, mm, dd] = (d || "").split("-");
  if (!dd || !mm || !yyyy) return "";
  return `${dd}-${mm}-${yyyy}`;
}
