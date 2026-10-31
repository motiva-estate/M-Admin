import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { formatNaira, numberToWords } from "@/lib/receipt";

export interface ReceiptPaymentEntry {
  paymentDate: string;
  paymentMethod: string;
  bankName?: string;
  accountNumber?: string;
  amount: number;
}

export interface ReceiptPreviewProps {
  receiptNumber?: string;
  dateIssued?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  paymentDescription?: string;
  amountReceived: number;
  paymentEntries: ReceiptPaymentEntry[];
  status?: "DRAFT" | "ISSUED" | "VOIDED";
  /** Base64 data URL once the receipt has been issued (server-generated). */
  qrCodeData?: string;
  // ── Company / sign-off fields ──────────────────────────────────────────
  companyAddress?: string;
  companyWebsite?: string;
  companyEmail?: string;
  companyPhone?: string;
  /** Name printed on the signature line (default: "Finance Manager"). */
  signatory?: string;
  /** Base64 data URL of uploaded signature / stamp image. */
  signatureImage?: string;
  /** Custom disclaimer text. */
  disclaimer?: string;
}

const NAVY = "#353046";
const GOLD = "#D6C29A";
const STRIPE = "#F2EFE7";
const TEXT = "#4A4558";

const DEFAULT_DISCLAIMER =
  "This receipt acknowledges the sum received as shown in the payment details above, based on proof of payment forwarded to us. All payments remain subject to confirmation by our accounts department due to the nature of electronic transaction failures and interruptions.";

/** A small uppercase tracking label used throughout the document. */
function Label({
  children,
  color = NAVY,
  className = "",
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`font-bold uppercase tracking-[0.16em] ${className}`}
      style={{ color, fontSize: 8 }}
    >
      {children}
    </span>
  );
}

/**
 * The branded Motiva receipt document, laid out at a fixed 800 px design width
 * so it can be scaled uniformly to fit any preview pane. Visually mirrors the
 * server-generated PDF (navy header with logo, gold accents, payment table,
 * signature image, QR, company footer).
 */
export function ReceiptPreview({
  receiptNumber,
  dateIssued,
  clientName,
  clientPhone,
  clientEmail,
  paymentDescription,
  amountReceived,
  paymentEntries,
  status,
  qrCodeData,
  companyAddress,
  companyWebsite,
  companyEmail,
  companyPhone,
  signatory,
  signatureImage,
  disclaimer,
}: ReceiptPreviewProps) {
  const entries = paymentEntries.length
    ? paymentEntries
    : [{ paymentDate: "", paymentMethod: "", amount: 0 } as ReceiptPaymentEntry];

  const signatoryLabel = signatory?.trim() || "Finance Manager";

  // Build footer line from whatever company fields are set, falling back to
  // the static Motiva defaults so the preview is never empty.
  const footerParts: string[] = [];
  footerParts.push("Motiva");
  if (companyAddress?.trim()) footerParts.push(companyAddress.trim());
  if (companyWebsite?.trim()) footerParts.push(companyWebsite.trim());
  if (companyEmail?.trim()) footerParts.push(companyEmail.trim());
  if (companyPhone?.trim()) footerParts.push(companyPhone.trim());

  // If only "Motiva" is set, add the static defaults so it isn't bare.
  if (footerParts.length === 1) {
    footerParts.push(
      "123 Estate Avenue, Abuja, Nigeria",
      "www.motivaestate.com",
      "info@motivaestate.com",
      "+234 800 123 4567",
    );
  }

  const footerLine = footerParts.join("  |  ");

  return (
    <div
      className="relative mx-auto bg-white font-sans text-[#4A4558]"
      style={{ width: 800, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* ───────── Header ───────── */}
      <div
        className="relative text-white"
        style={{ background: NAVY, paddingTop: 40, paddingBottom: 26 }}
      >
        {/* gold top bar */}
        <div className="absolute inset-x-0 top-0" style={{ height: 5, background: GOLD }} />

        <div className="flex items-start justify-between" style={{ padding: "0 56px" }}>
          {/* Left: logo + RECEIPT heading */}
          <div>
            {/* Logo — served from /motiva-logo.png (public folder) */}
            <div className="flex items-center">
              <img
                src="/motiva-logo.png"
                alt="Motiva"
                style={{ width: 52, height: 52, objectFit: "contain", display: "block" }}
              />
              <div
                className="font-extrabold"
                style={{ color: GOLD, fontSize: 24, letterSpacing: "0.5px" }}
              >
                Motiva
              </div>
            </div>
            <div
              className="font-extrabold"
              style={{ fontSize: 38, letterSpacing: "2px", marginTop: 18, lineHeight: 1 }}
            >
              RECEIPT
            </div>
            <Label color={GOLD} className="mt-2 block">
              Payment acknowledgement
            </Label>
          </div>

          {/* Right: date / receipt# / issued-to */}
          <div className="text-right" style={{ width: 220 }}>
            <Label color={GOLD}>Date issued</Label>
            <div className="font-semibold" style={{ fontSize: 11, marginTop: 2 }}>
              {dateIssued || "—"}
            </div>
            <div style={{ marginTop: 12 }}>
              <Label color={GOLD}>Receipt number</Label>
              <div className="font-semibold" style={{ fontSize: 11, marginTop: 2 }}>
                {receiptNumber ? `#${receiptNumber}` : "Pending issue"}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Label color={GOLD}>Issued to</Label>
              <div className="font-semibold truncate" style={{ fontSize: 11, marginTop: 2 }}>
                {clientName || "Select a client"}
              </div>
              {clientPhone && <div style={{ fontSize: 10, marginTop: 2 }}>{clientPhone}</div>}
              {clientEmail && (
                <div className="truncate" style={{ fontSize: 10, marginTop: 2 }}>
                  {clientEmail}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ───────── Content card ───────── */}
      <div
        className="relative bg-white"
        style={{
          margin: "-22px 40px 0",
          borderTop: `3px solid ${GOLD}`,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: "30px 36px 28px",
        }}
      >
        {/* Description + amount box */}
        <div className="grid items-start" style={{ gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
          <div>
            <Label>Payment description</Label>
            <p
              className="whitespace-pre-wrap"
              style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8, color: TEXT }}
            >
              {paymentDescription || (
                <span style={{ color: "#b9b5c0" }}>Describe what the payment covers…</span>
              )}
            </p>
          </div>
          <div
            className="flex flex-col justify-between"
            style={{ background: GOLD, padding: "14px 16px", minHeight: 72 }}
          >
            <Label>Amount received</Label>
            <div className="font-extrabold" style={{ color: NAVY, fontSize: 18, marginTop: 6 }}>
              ₦ {formatNaira(amountReceived)}
            </div>
          </div>
        </div>

        {/* ───────── Payment table ───────── */}
        <table
          className="w-full"
          style={{ marginTop: 22, borderCollapse: "collapse", tableLayout: "fixed" }}
        >
          <thead>
            <tr style={{ background: NAVY }}>
              <th
                className="text-left text-white font-bold"
                style={{ padding: "9px 10px", fontSize: 8, width: "8%" }}
              >
                No.
              </th>
              <th
                className="text-left text-white font-bold"
                style={{ padding: "9px 10px", fontSize: 8, width: "22%" }}
              >
                Payment date
              </th>
              <th
                className="text-left text-white font-bold"
                style={{ padding: "9px 10px", fontSize: 8, width: "48%" }}
              >
                Payment method
              </th>
              <th
                className="text-right text-white font-bold"
                style={{ padding: "9px 10px", fontSize: 8, width: "22%" }}
              >
                Amount (₦)
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const method = entry.bankName
                ? `${entry.paymentMethod} (${entry.bankName}${entry.accountNumber ? " – " + entry.accountNumber : ""})`
                : entry.paymentMethod || "—";
              return (
                <tr key={i} style={{ background: i % 2 === 1 ? STRIPE : "transparent" }}>
                  <td
                    style={{
                      padding: "8px 10px",
                      fontSize: 9,
                      color: TEXT,
                      verticalAlign: "top",
                    }}
                  >
                    {i + 1}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      fontSize: 9,
                      color: TEXT,
                      verticalAlign: "top",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {entry.paymentDate || "—"}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      fontSize: 9,
                      color: TEXT,
                      verticalAlign: "top",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {method}
                  </td>
                  <td
                    className="text-right"
                    style={{
                      padding: "8px 10px",
                      fontSize: 9,
                      color: TEXT,
                      verticalAlign: "top",
                    }}
                  >
                    {formatNaira(entry.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                className="text-right font-extrabold"
                colSpan={3}
                style={{
                  background: NAVY,
                  color: "#fff",
                  padding: "10px 12px",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                }}
              >
                TOTAL PAID
              </td>
              <td
                className="text-right font-extrabold"
                style={{ background: GOLD, color: NAVY, padding: "10px 12px", fontSize: 10 }}
              >
                ₦ {formatNaira(amountReceived)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ───────── Amount in words ───────── */}
        <div style={{ marginTop: 18 }}>
          <Label>Amount in words</Label>
          <p className="font-semibold italic" style={{ fontSize: 11, marginTop: 6, color: TEXT }}>
            {numberToWords(amountReceived)}
          </p>
        </div>

        {/* ───────── Thank you / signature / QR ───────── */}
        <div
          className="grid items-end"
          style={{
            gridTemplateColumns: "1fr 1fr 96px",
            gap: 16,
            marginTop: 34,
            marginBottom: 24,
            minHeight: 110,
          }}
        >
          {/* Thank you */}
          <div>
            <div className="font-extrabold" style={{ color: NAVY, fontSize: 22 }}>
              THANK YOU!
            </div>
            <Label className="mt-1.5 block">Pleasure doing business with you</Label>
          </div>

          {/* Signature line */}
          <div className="flex flex-col items-start justify-end">
            {signatureImage ? (
              <img
                src={signatureImage}
                alt="Signature"
                style={{
                  maxWidth: 160,
                  maxHeight: 70,
                  objectFit: "contain",
                  marginBottom: 4,
                  display: "block",
                }}
              />
            ) : null}
            <div style={{ borderTop: `1px solid ${NAVY}`, width: "100%", marginBottom: 6 }} />
            <div style={{ fontSize: 9, color: TEXT }}>
              <span className="font-bold">{signatoryLabel}</span> — Sign, Stamp &amp; Date
            </div>
          </div>

          {/* QR */}
          <div className="flex flex-col items-center" style={{ gap: 5 }}>
            {qrCodeData ? (
              <img src={qrCodeData} alt="Verify receipt" style={{ width: 80, height: 80 }} />
            ) : (
              <div
                className="grid place-items-center"
                style={{
                  width: 80,
                  height: 80,
                  border: "1px dashed #b9b5c0",
                  color: "#b9b5c0",
                  fontSize: 9,
                  textAlign: "center",
                  padding: 4,
                }}
              >
                QR on issue
              </div>
            )}
            <span
              className="font-extrabold"
              style={{ fontSize: 7, letterSpacing: "0.1em", color: NAVY }}
            >
              SCAN TO VERIFY
            </span>
          </div>
        </div>

        {/* ───────── Disclaimer ───────── */}
        <div style={{ borderTop: `1px solid ${GOLD}`, paddingTop: 10, marginTop: 8 }}>
          <Label>Disclaimer</Label>
          <p style={{ fontSize: 8, lineHeight: 1.5, marginTop: 4, color: TEXT }}>
            {disclaimer?.trim() || DEFAULT_DISCLAIMER}
          </p>
        </div>

        {/* ───────── Footer ───────── */}
        <div
          className="text-center"
          style={{
            borderTop: `1px solid ${GOLD}`,
            marginTop: 30,
            paddingTop: 10,
            fontSize: 8,
            color: "#5c5663",
          }}
        >
          {footerLine}
        </div>
      </div>

      {/* ───────── VOID watermark ───────── */}
      {status === "VOIDED" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
          <span
            className="font-extrabold"
            style={{
              transform: "rotate(-30deg)",
              fontSize: 120,
              color: "#ff0000",
              opacity: 0.12,
              letterSpacing: "0.1em",
            }}
          >
            VOID
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Wraps a fixed-width receipt and scales it down to fit its container width,
 * reserving the correct vertical space so layout flows naturally.
 */
export function ScaledReceipt({
  children,
  designWidth = 800,
}: {
  children: ReactNode;
  designWidth?: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);

  // Fit-to-width: scale = containerWidth / designWidth (capped at 1).
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const update = () => setScale(Math.min(1, vp.clientWidth / designWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(vp);
    return () => ro.disconnect();
  }, [designWidth]);

  // Track the unscaled content height so we can reserve scaledHeight.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => setContentHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-measure shortly after mount once fonts/layout settle.
  useEffect(() => {
    const t = setTimeout(() => {
      if (contentRef.current) setContentHeight(contentRef.current.offsetHeight);
    }, 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <div ref={viewportRef} className="w-full">
      <div style={{ height: contentHeight ? contentHeight * scale : undefined }}>
        <div
          ref={contentRef}
          style={{
            width: designWidth,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
