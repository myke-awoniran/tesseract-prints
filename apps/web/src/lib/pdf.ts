// In-browser PDF reading and editing. Documents never leave the device until the order is placed.
// pdf.js (rendering) and pdf-lib (writing) are loaded on demand so they stay out of the main bundle.
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export type PdfDoc = PDFDocumentProxy;
export type PdfPage = PDFPageProxy;

/** One page in an edited document: which original page it is, and how far the user has turned it. */
export interface PageEdit {
  source: number;
  rotation: number;
}

let pdfjs: Promise<typeof import('pdfjs-dist')> | null = null;

function loadPdfjs() {
  pdfjs ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  });
  return pdfjs;
}

export const isPdf = (file: File | null | undefined): file is File => file?.type === 'application/pdf';

export class PdfLockedError extends Error {
  constructor() {
    super('This PDF is password-protected.');
  }
}

export async function openPdf(file: File): Promise<PdfDoc> {
  const lib = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  try {
    return await lib.getDocument({ data, isEvalSupported: false }).promise;
  } catch (err) {
    if ((err as { name?: string } | null)?.name === 'PasswordException') throw new PdfLockedError();
    throw err;
  }
}

/**
 * Draws a page into a canvas at the given CSS width, sharp on high-density screens.
 * Returns a cancel function for when the canvas is unmounted or redrawn mid-render.
 */
export function drawPage(page: PdfPage, canvas: HTMLCanvasElement, cssWidth: number, extraRotation = 0): () => void {
  const rotation = (page.rotate + extraRotation) % 360;
  const unit = page.getViewport({ scale: 1, rotation });
  const scale = cssWidth / unit.width;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: scale * ratio, rotation });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
  canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const task = page.render({ canvasContext: ctx, viewport });
  task.promise.catch(() => {});
  return () => task.cancel();
}

/** Width-to-height ratio of a page as it will appear, so placeholders hold their shape before rendering. */
export function pageAspect(page: PdfPage, extraRotation = 0): number {
  const v = page.getViewport({ scale: 1, rotation: (page.rotate + extraRotation) % 360 });
  return v.width / v.height;
}

/** Writes a new PDF with pages kept, reordered and rotated as edited. */
export async function buildEditedPdf(file: File, edits: PageEdit[]): Promise<File> {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const source = await PDFDocument.load(await file.arrayBuffer());
  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    source,
    edits.map((e) => e.source)
  );
  copied.forEach((page, i) => {
    const turn = edits[i].rotation;
    if (turn) page.setRotation(degrees((page.getRotation().angle + turn) % 360));
    out.addPage(page);
  });
  const bytes = await out.save();
  return new File([bytes as Uint8Array<ArrayBuffer>], file.name, { type: 'application/pdf', lastModified: Date.now() });
}

export function isUnchanged(edits: PageEdit[], total: number): boolean {
  return edits.length === total && edits.every((e, i) => e.source === i && e.rotation === 0);
}
