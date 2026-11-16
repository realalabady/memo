/**
 * ZATCA (Fatoora) phase-1 QR payload for a simplified tax invoice:
 * TLV-encoded seller name, VAT number, timestamp, total (incl. VAT) and VAT amount, as base64.
 * This is the human-scannable QR only — phase-2 clearance/reporting (signed XML) is not implemented.
 */
export function zatcaQrPayload(input: { sellerName: string; vatNumber: string; timestamp: number; total: number; vat: number }) {
  const enc = new TextEncoder();
  const fields = [
    input.sellerName,
    input.vatNumber,
    new Date(input.timestamp).toISOString().replace(/\.\d{3}Z$/, "Z"),
    input.total.toFixed(2),
    input.vat.toFixed(2),
  ];
  const bytes: number[] = [];
  fields.forEach((value, i) => {
    const v = enc.encode(value);
    if (v.length > 255) throw new Error("ZATCA QR field too long");
    bytes.push(i + 1, v.length, ...v);
  });
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
