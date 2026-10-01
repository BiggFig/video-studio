import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { extractPrd } from "./ingest";
import { cancelCommands } from "./media";
import { PipelineError } from "./types";

// Opt in with STUDIO_PDF_INTEGRATION=1 and pdftotext on PATH or PDFTOTEXT_PATH.
// These tests call the installed reader through extractPrd's default command path.
const integration = { skip: process.env.STUDIO_PDF_INTEGRATION !== "1" ? "Set STUDIO_PDF_INTEGRATION=1 with an actual pdftotext executable" : false, timeout: 20_000 };
const ascii = (text: string) => Buffer.from(text, "ascii");

/** Small self-contained PDF writer; offsets and stream lengths count actual bytes. */
function pdf(objects: Buffer[]): Buffer {
  const pieces = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")], offsets = [0];
  let length = pieces[0].length;
  for (const [index, object] of objects.entries()) {
    offsets.push(length);
    const encoded = Buffer.concat([ascii(`${index + 1} 0 obj\n`), object, ascii("\nendobj\n")]);
    pieces.push(encoded); length += encoded.length;
  }
  pieces.push(ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return Buffer.concat(pieces);
}

function stream(bytes: Buffer, dictionary = "") {
  return Buffer.concat([ascii(`<< ${dictionary} /Length ${bytes.length} >>\nstream\n`), bytes, ascii("\nendstream")]);
}

function textPdf(): Buffer {
  // WinAnsi e-acute encoded with a PDF octal escape; extracted output must be UTF-8.
  const lines = [
    "Caf\\351 product workspace requirements",
    "The workspace helps product teams organize release plans and feature notes.",
    "Members collect project requirements and attach real product screenshots.",
    "A shared library keeps each approved brief available for later review.",
    "The interface presents clear navigation, readable labels, and useful errors.",
  ];
  const content = ascii(`BT\n/F1 12 Tf\n18 TL\n50 750 Td\n${lines.map(line => `(${line}) Tj\nT*`).join("\n")}\nET`);
  return pdf([
    ascii("<< /Type /Catalog /Pages 2 0 R >>"),
    ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    ascii("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"),
    stream(content),
    ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
  ]);
}

function imageOnlyPdf(): Buffer {
  return pdf([
    ascii("<< /Type /Catalog /Pages 2 0 R >>"),
    ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    ascii("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>"),
    stream(ascii("q\n200 0 0 200 50 500 cm\n/Im1 Do\nQ")),
    stream(Buffer.from([40, 90, 180]), "/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8"),
  ]);
}

async function fixture(t: TestContext) {
  const root = await realpath(tmpdir()), workspace = await mkdtemp(join(root, "video-studio-pdf-test-"));
  await mkdir(join(workspace, "assets")); await mkdir(join(workspace, "analysis"));
  let expired = false;
  const timer = setTimeout(() => { expired = true; cancelCommands(); }, 15_000); timer.unref();
  t.after(async () => {
    clearTimeout(timer); cancelCommands();
    const target = await realpath(workspace);
    if (resolve(target) !== resolve(workspace) || dirname(target) !== root || !basename(target).startsWith("video-studio-pdf-test-")) throw new Error("PDF fixture cleanup escaped its temporary directory");
    await rm(target, { recursive: true, force: true });
    assert.equal(expired, false, "The actual document reader exceeded its 15-second test deadline");
  });
  return workspace;
}

function issue(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof PipelineError);
    assert.equal(error.code, code); assert.equal(error.status, "needs_input"); assert.equal(error.retryable, false);
    assert.match(error.action, /text|Markdown|OCR/); return true;
  };
}

test("actual pdftotext extracts a complete synthetic PRD and returns UTF-8 text", integration, async t => {
  const workspace = await fixture(t), bytes = textPdf();
  const result = await extractPrd(bytes, workspace, 0, true);
  assert.equal(result.path, "assets/prd-0.pdf");
  assert.ok(result.text.trim().length > 250);
  assert.match(result.text, /Caf\u00e9 product workspace requirements/);
  assert.match(result.text, /organize release plans and feature notes/);
  assert.match(result.text, /readable labels, and useful errors/);
  assert.equal(result.text.includes("\ufffd"), false);
  assert.deepEqual(await readFile(join(workspace, result.path)), bytes);
  const extracted = await readFile(join(workspace, "analysis/prd-0.txt"));
  assert.equal(new TextDecoder("utf-8", { fatal: true }).decode(extracted), result.text);
});

test("actual pdftotext rejects a PDF-signature file with damaged document structure", integration, async t => {
  const workspace = await fixture(t), bytes = ascii("%PDF-1.4\nDamaged document: no catalog, page tree, objects, or cross-reference table.\n%%EOF\n");
  await assert.rejects(extractPrd(bytes, workspace, 1, true), issue("prd_unreadable"));
  // The valid signature passes the application's header guard and reaches the real parser.
  assert.deepEqual(await readFile(join(workspace, "assets/prd-1.pdf")), bytes);
});

test("actual pdftotext rejects a valid image-only PDF with actionable OCR guidance", integration, async t => {
  const workspace = await fixture(t), bytes = imageOnlyPdf();
  await assert.rejects(extractPrd(bytes, workspace, 2, true), error => {
    issue("prd_insufficient_text")(error);
    assert.ok(error instanceof PipelineError); assert.match(error.action, /OCR/); return true;
  });
  assert.deepEqual(await readFile(join(workspace, "assets/prd-2.pdf")), bytes);
  assert.equal((await readFile(join(workspace, "analysis/prd-2.txt"), "utf8")).trim(), "");
});
