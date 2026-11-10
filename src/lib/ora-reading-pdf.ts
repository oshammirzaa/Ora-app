import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ReadingPdfMessage = {
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string;
  recalled: boolean;
  attachment: string;
  tipGift: string;
};

export type ReadingReport = {
  id: string;
  customerName: string;
  customerId: string;
  advisorName: string;
  advisorId: string;
  startedAt: string;
  endedAt: string;
  duration: string;
  freeTime: string;
  paidTime: string;
  coins: number;
  status: string;
  endReason: string;
  messages: ReadingPdfMessage[];
  truncated: boolean;
  generatedAt: string;
};

const BURGUNDY = rgb(122 / 255, 78 / 255, 108 / 255);
const GOLD = rgb(196 / 255, 163 / 255, 90 / 255);
const INK = rgb(36 / 255, 28 / 255, 34 / 255);
const MUTED = rgb(96 / 255, 84 / 255, 92 / 255);
const CREAM = rgb(251 / 255, 246 / 255, 238 / 255);

/** PDF standard fonts cannot draw every Unicode character. The stored message is not changed. */
export function pdfSafe(value: unknown) {
  return String(value ?? "")
    .replace(/\t/g, " ")
    .replace(/\r/g, "")
    .replace(/[^\n\x20-\x7E]/g, "?");
}

export function readingReportLines(input: ReadingReport) {
  const lines = [
    "ORA PSYCHIC",
    "Private Reading Report",
    `Customer: ${input.customerName} (${input.customerId})`,
    `Advisor: ${input.advisorName} (${input.advisorId})`,
    `Reading: ${input.id}`,
    `Started: ${input.startedAt || "Not recorded"}`,
    `Ended: ${input.endedAt || "Not recorded"}`,
    `Duration: ${input.duration}`,
    `Free time: ${input.freeTime}`,
    `Paid time: ${input.paidTime}`,
    `Coins charged: ${input.coins}`,
    `Status: ${input.status}`,
    `Ending note: ${input.endReason || "Not recorded"}`,
    "Conversation",
  ];
  if (!input.messages.length) lines.push("No messages were stored for this reading.");
  for (const message of input.messages) {
    lines.push(`${message.senderRole}: ${message.senderName}`);
    lines.push(message.createdAt || "Time not recorded");
    const body = String(message.body || "").trim();
    lines.push(body || (message.attachment ? "" : "(No text stored)"));
    if (message.attachment) lines.push(message.attachment);
    if (message.tipGift) lines.push(`Tip: ${message.tipGift}`);
    if (message.recalled) lines.push("Recalled");
  }
  if (input.truncated) {
    lines.push("This PDF copy stops after the messages listed above. Later messages stay in the private database.");
  }
  lines.push("Confidential. Authorized Ora administrators only. Not for public distribution.");
  lines.push(`Generated ${input.generatedAt}. Original messages remain the record.`);
  return lines;
}

function wrap(value: string, width: number) {
  const clean = pdfSafe(value).replace(/\n/g, " ").trim();
  if (!clean) return [""];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const piece = word.length > width ? word.slice(0, width) : word;
    const next = current ? `${current} ${piece}` : piece;
    if (next.length > width && current) {
      lines.push(current);
      current = piece;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildReadingPdf(input: ReadingReport) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const footer = 56;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight;

  const paintHeader = () => {
    page.drawRectangle({ x: 0, y: pageHeight - 86, width: pageWidth, height: 86, color: BURGUNDY });
    page.drawCircle({ x: 42, y: pageHeight - 40, size: 16, color: GOLD });
    page.drawCircle({ x: 42, y: pageHeight - 40, size: 11, color: CREAM });
    page.drawCircle({ x: 38, y: pageHeight - 36, size: 7, color: BURGUNDY });
    page.drawText("ORA PSYCHIC", { x: 68, y: pageHeight - 34, size: 16, font: bold, color: GOLD });
    page.drawText("Private Reading Report", { x: 68, y: pageHeight - 54, size: 11, font, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: 68, y: pageHeight - 68, width: 72, height: 2, color: GOLD });
    y = pageHeight - 108;
  };

  const paintFooter = (target: typeof page) => {
    target.drawRectangle({ x: margin, y: 36, width: pageWidth - margin * 2, height: 1, color: GOLD });
    const note = pdfSafe(
      `Confidential. Authorized administrator use only. Generated ${input.generatedAt}. Not a public file.`,
    ).slice(0, 110);
    target.drawText(note, { x: margin, y: 22, size: 8, font, color: MUTED });
  };

  const nextPage = () => {
    paintFooter(page);
    page = doc.addPage([pageWidth, pageHeight]);
    paintHeader();
  };

  const ensure = (need: number) => {
    if (y - need < footer) nextPage();
  };

  const write = (text: string, size: number, face: typeof font, color = INK) => {
    for (const line of wrap(text, size >= 12 ? 78 : 92)) {
      ensure(size + 6);
      page.drawText(pdfSafe(line).slice(0, 110), { x: margin, y, size, font: face, color });
      y -= size + 4;
    }
  };

  paintHeader();
  const facts = [
    `Customer: ${input.customerName}  ·  ${input.customerId}`,
    `Advisor: ${input.advisorName}  ·  ${input.advisorId}`,
    `Reading: ${input.id}`,
    `Started: ${input.startedAt || "Not recorded"}`,
    `Ended: ${input.endedAt || "Not recorded"}`,
    `Duration: ${input.duration}    Free: ${input.freeTime}    Paid: ${input.paidTime}`,
    `Coins charged: ${input.coins}    Status: ${input.status}`,
    `Ending note: ${input.endReason || "Not recorded"}`,
  ];
  for (const fact of facts) write(fact, 10, font);
  y -= 8;
  ensure(20);
  write("Conversation", 13, bold, BURGUNDY);
  y -= 4;
  if (!input.messages.length) write("No messages were stored for this reading.", 10, font, MUTED);
  for (const message of input.messages) {
    y -= 6;
    write(`${message.senderRole} · ${message.senderName}`, 10, bold);
    write(message.createdAt || "Time not recorded", 8, font, MUTED);
    const body = String(message.body || "").trim();
    write(body || (message.attachment ? "" : "(No text stored)"), 10, font);
    if (message.attachment) write(message.attachment, 9, font, MUTED);
    if (message.tipGift) write(`Tip: ${message.tipGift}`, 9, font, MUTED);
    if (message.recalled) write("Recalled", 9, font, BURGUNDY);
  }
  if (input.truncated) {
    y -= 8;
    write("This PDF copy stops after the messages above. Later messages stay in the private database.", 9, font, MUTED);
  }
  y -= 10;
  write("Characters this font cannot draw are shown as question marks. The stored message is unchanged.", 8, font, MUTED);
  paintFooter(page);
  return doc.save();
}
