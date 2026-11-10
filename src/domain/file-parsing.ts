import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

export type DocumentKind = "pdf" | "docx";

export type ParsedDocument = {
  kind: DocumentKind;
  pages: number;
  pagesExact: boolean;
};

export type ParseErrorCode =
  | "unsupported"
  | "encrypted"
  | "corrupted"
  | "empty";

export class FileParseError extends Error {
  constructor(
    message: string,
    readonly code: ParseErrorCode,
  ) {
    super(message);
    this.name = "FileParseError";
  }
}

const APPROX_CHARS_PER_PAGE = 1800;

/** Визначає тип файлу за магічними байтами, а не за розширенням. */
export function detectKind(bytes: Uint8Array): DocumentKind | null {
  const isPdf =
    bytes.length >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d; // -

  if (isPdf) {
    return "pdf";
  }

  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08);

  if (isZip) {
    return "docx";
  }

  return null;
}

export async function parseDocument(bytes: Uint8Array): Promise<ParsedDocument> {
  if (bytes.length === 0) {
    throw new FileParseError("Файл порожній", "empty");
  }

  const kind = detectKind(bytes);
  if (!kind) {
    throw new FileParseError(
      "Підтримуються лише PDF і DOCX. Надішліть файл як документ.",
      "unsupported",
    );
  }

  return kind === "pdf" ? parsePdf(bytes) : parseDocx(bytes);
}

async function parsePdf(bytes: Uint8Array): Promise<ParsedDocument> {
  try {
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    const pages = document.getPageCount();
    if (pages < 1) {
      throw new FileParseError("PDF не містить сторінок", "empty");
    }
    return { kind: "pdf", pages, pagesExact: true };
  } catch (error) {
    if (error instanceof FileParseError) {
      throw error;
    }
    const name = (error as { name?: string } | null)?.name ?? "";
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt/i.test(name) || /encrypt/i.test(message)) {
      throw new FileParseError(
        "PDF захищений паролем. Зніміть пароль і надішліть знову.",
        "encrypted",
      );
    }
    throw new FileParseError("Не вдалося прочитати PDF: файл пошкоджений.", "corrupted");
  }
}

async function parseDocx(bytes: Uint8Array): Promise<ParsedDocument> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new FileParseError("Не вдалося прочитати DOCX: файл пошкоджений.", "corrupted");
  }

  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new FileParseError(
      "Це не документ Word. Підтримуються лише PDF і DOCX.",
      "unsupported",
    );
  }

  const pages = await readDocxPages(zip, documentXmlFile);
  // Word зберігає лише приблизну кількість сторінок: рендеринг залежить від шрифтів.
  return { kind: "docx", pages, pagesExact: false };
}

async function readDocxPages(zip: JSZip, documentXmlFile: JSZip.JSZipObject): Promise<number> {
  const appXmlFile = zip.file("docProps/app.xml");

  if (appXmlFile) {
    const appXml = await appXmlFile.async("string");
    const parsed = parsePagesFromAppXml(appXml);
    if (parsed !== null) {
      return parsed;
    }
  }

  const documentXml = await documentXmlFile.async("string");
  return estimateDocxPages(documentXml);
}

function parsePagesFromAppXml(xml: string): number | null {
  try {
    const parsed = new XMLParser({ ignoreAttributes: true }).parse(xml) as {
      Properties?: { Pages?: unknown };
    };
    const raw = parsed.Properties?.Pages;
    const pages = Number(raw);
    if (Number.isInteger(pages) && pages > 0) {
      return pages;
    }
  } catch {
    // Ігноруємо: нижче буде оцінка за текстом.
  }
  return null;
}

function estimateDocxPages(documentXml: string): number {
  const manualBreaks = (
    documentXml.match(/<w:br[^>]*w:type="page"/g) ?? []
  ).length;
  const renderedBreaks = (documentXml.match(/<w:lastRenderedPageBreak/g) ?? []).length;
  const text = documentXml
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-zA-Z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const byContent = Math.ceil(text.length / APPROX_CHARS_PER_PAGE);
  return Math.max(1, manualBreaks + renderedBreaks + 1, byContent);
}
