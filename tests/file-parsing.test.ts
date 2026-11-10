import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  FileParseError,
  detectKind,
  parseDocument,
} from "../src/domain/file-parsing.js";

async function makePdf(pages: number): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) {
    document.addPage();
  }
  return document.save();
}

async function makeDocx(options: {
  pagesMarker?: number;
  text?: string;
}): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body><w:p><w:r><w:t>${options.text ?? "Привіт"}</w:t></w:r></w:p></w:body>
      </w:document>`,
  );
  if (options.pagesMarker !== undefined) {
    zip.file(
      "docProps/app.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
        <Properties><Pages>${options.pagesMarker}</Pages></Properties>`,
    );
  }
  return zip.generateAsync({ type: "uint8array" });
}

describe("detectKind", () => {
  it("розпізнає PDF за магічними байтами", () => {
    expect(detectKind(new TextEncoder().encode("%PDF-1.7\n..."))).toBe("pdf");
  });

  it("розпізнає ZIP/DOCX", async () => {
    const bytes = await makeDocx({});
    expect(detectKind(bytes)).toBe("docx");
  });

  it("відхиляє текстовий файл", () => {
    expect(detectKind(new TextEncoder().encode("просто текст"))).toBeNull();
  });
});

describe("parseDocument", () => {
  it("рахує сторінки PDF точно", async () => {
    const parsed = await parseDocument(await makePdf(4));
    expect(parsed).toEqual({ kind: "pdf", pages: 4, pagesExact: true });
  });

  it("бере кількість сторінок DOCX з app.xml, але позначає як орієнтовну", async () => {
    const parsed = await parseDocument(await makeDocx({ pagesMarker: 3 }));
    expect(parsed).toEqual({ kind: "docx", pages: 3, pagesExact: false });
  });

  it("оцінює сторінки DOCX без app.xml", async () => {
    const parsed = await parseDocument(await makeDocx({ text: "короткий текст" }));
    expect(parsed.kind).toBe("docx");
    expect(parsed.pages).toBeGreaterThanOrEqual(1);
    expect(parsed.pagesExact).toBe(false);
  });

  it("відхиляє порожній файл", async () => {
    await expect(parseDocument(new Uint8Array())).rejects.toBeInstanceOf(FileParseError);
  });

  it("відхиляє невідомий формат", async () => {
    await expect(
      parseDocument(new TextEncoder().encode("not a document")),
    ).rejects.toMatchObject({ code: "unsupported" });
  });
});
