import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { buildEditedPdf, drawPage, isUnchanged, pageAspect, type PageEdit, type PdfDoc, type PdfPage } from '../lib/pdf';
import { Icon } from './Icons';

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function usePage(doc: PdfDoc, source: number): PdfPage | null {
  const [page, setPage] = useState<PdfPage | null>(null);
  useEffect(() => {
    let live = true;
    doc.getPage(source + 1).then((p) => live && setPage(p), () => {});
    return () => {
      live = false;
    };
  }, [doc, source]);
  return page;
}

/** A page drawn into a canvas. Thumbnails wait until they scroll into view before rendering. */
function PageCanvas({ doc, edit, width, lazy = false }: { doc: PdfDoc; edit: PageEdit; width: number; lazy?: boolean }) {
  const page = usePage(doc, edit.source);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(!lazy);

  useEffect(() => {
    if (!lazy || visible || !frameRef.current) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '400px' });
    io.observe(frameRef.current);
    return () => io.disconnect();
  }, [lazy, visible]);

  useEffect(() => {
    if (!page || !visible || !canvasRef.current || width <= 0) return;
    return drawPage(page, canvasRef.current, width, edit.rotation);
  }, [page, visible, width, edit.rotation]);

  const aspect = page ? pageAspect(page, edit.rotation) : 1 / Math.SQRT2;
  return (
    <div ref={frameRef} className="pdfs-sheet" style={{ width, height: Math.round(width / aspect) }}>
      {page && visible ? <canvas ref={canvasRef} /> : <span className="spinner" aria-hidden="true" />}
    </div>
  );
}

interface PdfStudioProps {
  doc: PdfDoc;
  file: File;
  onClose: () => void;
  onSave: (file: File, pages: number) => void;
}

export function PdfStudio({ doc, file, onClose, onSave }: PdfStudioProps) {
  const total = doc.numPages;
  const initial = useRef<PageEdit[]>(Array.from({ length: total }, (_, i) => ({ source: i, rotation: 0 })));
  const [edits, setEdits] = useState<PageEdit[]>(initial.current);
  const [history, setHistory] = useState<PageEdit[][]>([]);
  const [current, setCurrent] = useState(0);
  const [zoom, setZoom] = useState(2);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stageWidth, setStageWidth] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const removed = Array.from({ length: total }, (_, i) => i).filter((i) => !edits.some((e) => e.source === i));
  const unchanged = isUnchanged(edits, total);
  const selected = edits[current];

  const commit = useCallback(
    (next: PageEdit[], nextCurrent = current) => {
      setHistory((h) => [...h.slice(-49), edits]);
      setEdits(next);
      setCurrent(Math.max(0, Math.min(nextCurrent, next.length - 1)));
    },
    [edits, current]
  );

  const rotate = (by: number) => {
    if (!selected) return;
    commit(edits.map((e, i) => (i === current ? { ...e, rotation: (e.rotation + by + 360) % 360 } : e)));
  };
  const rotateAll = () => commit(edits.map((e) => ({ ...e, rotation: (e.rotation + 90) % 360 })));
  const remove = (index = current) => {
    if (edits.length <= 1) {
      setError('A document needs at least one page.');
      return;
    }
    commit(
      edits.filter((_, i) => i !== index),
      index < current || current === edits.length - 1 ? current - 1 : current
    );
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= edits.length || from === to) return;
    const next = [...edits];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next, to);
  };
  const restore = (source: number) => {
    // Put the page back after the nearest earlier original page still in the document.
    const at = edits.findIndex((e) => e.source > source);
    const index = at === -1 ? edits.length : at;
    const next = [...edits];
    next.splice(index, 0, { source, rotation: 0 });
    commit(next, index);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setEdits(prev);
    setCurrent((c) => Math.min(c, prev.length - 1));
  };
  const reset = () => commit(initial.current, 0);

  async function save() {
    if (unchanged) {
      onClose();
      return;
    }
    setSaving(true);
    setError('');
    try {
      onSave(await buildEditedPdf(file, edits), edits.length);
    } catch {
      setSaving(false);
      setError('We could not save these changes. The PDF may be protected; you can still upload it as it is.');
    }
  }

  // Keep the stage canvas sized to the space available.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lock page scroll and return focus to where it was when the studio closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  // Keep the selected thumbnail in view.
  useEffect(() => {
    railRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).tagName === 'SELECT') return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape') onClose();
    else if (mod && e.key.toLowerCase() === 'z') undo();
    else if (mod) return;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') {
      if (e.altKey) move(current, current + 1);
      else setCurrent((c) => Math.min(c + 1, edits.length - 1));
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
      if (e.altKey) move(current, current - 1);
      else setCurrent((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Home') setCurrent(0);
    else if (e.key === 'End') setCurrent(edits.length - 1);
    else if (e.key.toLowerCase() === 'r') rotate(e.shiftKey ? -90 : 90);
    else if (e.key === 'Delete' || e.key === 'Backspace') remove();
    else return;
    e.preventDefault();
  }

  const onDragStart = (i: number) => (e: DragEvent) => {
    setDragFrom(i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(i));
  };
  const onDragOver = (i: number) => (e: DragEvent<HTMLElement>) => {
    if (dragFrom === null) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    // The rail runs across the bottom of the screen on phones.
    const horizontal = window.matchMedia('(max-width: 760px)').matches;
    const after = horizontal ? e.clientX > rect.left + rect.width / 2 : e.clientY > rect.top + rect.height / 2;
    setDropAt(after ? i + 1 : i);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (dragFrom !== null && dropAt !== null) move(dragFrom, dropAt > dragFrom ? dropAt - 1 : dropAt);
    setDragFrom(null);
    setDropAt(null);
  };

  const sheetWidth = Math.max(160, Math.min(stageWidth - 48, 760) * ZOOMS[zoom]);

  return (
    <div className="pdfs" role="dialog" aria-modal="true" aria-label={`Preview and edit ${file.name}`} ref={dialogRef} tabIndex={-1} onKeyDown={onKey}>
      <header className="pdfs-bar">
        <div className="pdfs-bar__title">
          <Icon.File width={20} height={20} />
          <div>
            <strong title={file.name}>{file.name}</strong>
            <small>
              {edits.length} {edits.length === 1 ? 'page' : 'pages'}
              {edits.length !== total && ` · ${total} in original`}
              {!unchanged && <span className="pdfs-dot">Unsaved changes</span>}
            </small>
          </div>
        </div>
        <div className="pdfs-bar__actions">
          <button type="button" className="pdfs-btn pdfs-btn--ghost" onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)">
            <Icon.Undo width={18} height={18} />
            <span>Undo</span>
          </button>
          <button type="button" className="pdfs-btn pdfs-btn--ghost" onClick={reset} disabled={unchanged}>
            <span>Reset</span>
          </button>
          <button type="button" className="pdfs-btn pdfs-btn--ghost" onClick={onClose}>
            <span>Cancel</span>
          </button>
          <button type="button" className="pdfs-btn pdfs-btn--primary" onClick={save} disabled={saving}>
            {saving && <span className="spinner" aria-hidden="true" />}
            <span>{saving ? 'Saving' : unchanged ? 'Done' : 'Save changes'}</span>
          </button>
        </div>
      </header>

      {error && (
        <p className="pdfs-error" role="alert">
          {error}
          <button type="button" aria-label="Dismiss" onClick={() => setError('')}>
            <Icon.Close width={16} height={16} />
          </button>
        </p>
      )}

      <div className="pdfs-body">
        <aside className="pdfs-rail" aria-label="Pages" ref={railRef} onDragOver={(e) => dragFrom !== null && e.preventDefault()} onDrop={onDrop}>
          <ol>
            {edits.map((edit, i) => (
              <li
                key={`${edit.source}`}
                data-index={i}
                className={[
                  'pdfs-thumb',
                  i === current && 'is-current',
                  dragFrom === i && 'is-dragging',
                  dropAt === i && 'drop-before',
                  dropAt === i + 1 && i === edits.length - 1 && 'drop-after'
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable
                onDragStart={onDragStart(i)}
                onDragOver={onDragOver(i)}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDropAt(null);
                }}
              >
                <button type="button" className="pdfs-thumb__pick" onClick={() => setCurrent(i)} aria-current={i === current} aria-label={`Page ${i + 1}${edit.source !== i ? `, originally page ${edit.source + 1}` : ''}`}>
                  <PageCanvas doc={doc} edit={edit} width={112} lazy />
                </button>
                <span className="pdfs-thumb__num">
                  {i + 1}
                  {edit.source !== i && <small>was {edit.source + 1}</small>}
                </span>
                <span className="pdfs-thumb__tools">
                  <button type="button" aria-label={`Rotate page ${i + 1}`} title="Rotate" onClick={() => commit(edits.map((e, j) => (j === i ? { ...e, rotation: (e.rotation + 90) % 360 } : e)), i)}>
                    <Icon.RotateRight width={15} height={15} />
                  </button>
                  <button type="button" aria-label={`Remove page ${i + 1}`} title="Remove" onClick={() => remove(i)}>
                    <Icon.Trash width={15} height={15} />
                  </button>
                </span>
              </li>
            ))}
          </ol>

          {removed.length > 0 && (
            <div className="pdfs-removed">
              <p>Removed ({removed.length})</p>
              <ul>
                {removed.map((source) => (
                  <li key={source}>
                    <span>Page {source + 1}</span>
                    <button type="button" onClick={() => restore(source)}>
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <main className="pdfs-stage" ref={stageRef}>
          <div className="pdfs-stage__scroll">{selected && stageWidth > 0 && <PageCanvas key={selected.source} doc={doc} edit={selected} width={sheetWidth} />}</div>

          <div className="pdfs-tools" role="toolbar" aria-label="Page tools">
            <div className="pdfs-tools__group">
              <button type="button" onClick={() => setCurrent((c) => Math.max(c - 1, 0))} disabled={current === 0} aria-label="Previous page">
                <Icon.ArrowLeft width={18} height={18} />
              </button>
              <span className="pdfs-tools__count" aria-live="polite">
                {current + 1} / {edits.length}
              </span>
              <button type="button" onClick={() => setCurrent((c) => Math.min(c + 1, edits.length - 1))} disabled={current >= edits.length - 1} aria-label="Next page">
                <Icon.ArrowRight width={18} height={18} />
              </button>
            </div>
            <div className="pdfs-tools__group">
              <button type="button" onClick={() => rotate(-90)} aria-label="Rotate left" title="Rotate left (Shift+R)">
                <Icon.RotateLeft width={18} height={18} />
              </button>
              <button type="button" onClick={() => rotate(90)} aria-label="Rotate right" title="Rotate right (R)">
                <Icon.RotateRight width={18} height={18} />
              </button>
              <button type="button" onClick={() => move(current, current - 1)} disabled={current === 0} aria-label="Move page earlier" title="Move earlier (Alt+↑)">
                <Icon.ArrowUp width={18} height={18} />
              </button>
              <button type="button" onClick={() => move(current, current + 1)} disabled={current >= edits.length - 1} aria-label="Move page later" title="Move later (Alt+↓)">
                <Icon.ArrowDown width={18} height={18} />
              </button>
              <button type="button" className="is-danger" onClick={() => remove()} aria-label="Remove page" title="Remove (Delete)">
                <Icon.Trash width={18} height={18} />
              </button>
            </div>
            <div className="pdfs-tools__group">
              <button type="button" onClick={() => setZoom((z) => Math.max(z - 1, 0))} disabled={zoom === 0} aria-label="Zoom out">
                <Icon.Minus width={18} height={18} />
              </button>
              <button type="button" className="pdfs-tools__zoom" onClick={() => setZoom(2)} title="Reset zoom">
                {Math.round(ZOOMS[zoom] * 100)}%
              </button>
              <button type="button" onClick={() => setZoom((z) => Math.min(z + 1, ZOOMS.length - 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Zoom in">
                <Icon.Plus width={18} height={18} />
              </button>
            </div>
            <button type="button" className="pdfs-tools__all" onClick={rotateAll}>
              Rotate all
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
