import { useEffect, useRef, useState } from 'react';
import { ACCEPTED_EXTENSIONS, ACCEPTED_FILE_TYPES, MAX_FILE_BYTES, MAX_FILE_MB } from '@tesseract/shared';
import { formatBytes } from '../lib/format';
import { drawPage, isPdf, openPdf, PdfLockedError, type PdfDoc } from '../lib/pdf';
import { Icon } from './Icons';
import { PdfStudio } from './PdfStudio';

export function checkFile(file: File | null): string {
  if (!file) return 'Choose a document to upload.';
  if (!ACCEPTED_FILE_TYPES[file.type]) return 'This file type is not supported. Upload a PDF, Word document, PNG or JPEG.';
  if (file.size > MAX_FILE_BYTES) return `Files can be up to ${MAX_FILE_MB} MB.`;
  if (file.size === 0) return 'This file is empty.';
  return '';
}

type PdfState = { status: 'reading' } | { status: 'ready'; doc: PdfDoc } | { status: 'locked' } | { status: 'unreadable' };

/** Opens a chosen PDF in the browser so it can be counted, previewed and edited before upload. */
function usePdf(file: File | null, onPages?: (pages: number | null) => void): PdfState | null {
  const [state, setState] = useState<PdfState | null>(null);
  const onPagesRef = useRef(onPages);
  onPagesRef.current = onPages;

  useEffect(() => {
    if (!isPdf(file)) {
      setState(null);
      return;
    }
    let live = true;
    let opened: PdfDoc | null = null;
    setState({ status: 'reading' });
    openPdf(file).then(
      (doc) => {
        opened = doc;
        if (!live) return void doc.destroy();
        setState({ status: 'ready', doc });
        onPagesRef.current?.(doc.numPages);
      },
      (err) => {
        if (!live) return;
        setState({ status: err instanceof PdfLockedError ? 'locked' : 'unreadable' });
        onPagesRef.current?.(null);
      }
    );
    return () => {
      live = false;
      void opened?.destroy();
    };
  }, [file]);

  return state;
}

function CoverThumb({ doc }: { doc: PdfDoc }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancel = () => {};
    let live = true;
    doc.getPage(1).then((page) => {
      if (live && ref.current) cancel = drawPage(page, ref.current, 44);
    }, () => {});
    return () => {
      live = false;
      cancel();
    };
  }, [doc]);
  return <canvas ref={ref} className="file-cover" aria-hidden="true" />;
}

/** Drag-and-drop file input. `variant` switches between the site and console styles. */
interface FileDropProps {
  file: File | null;
  onChange: (file: File | null) => void;
  /** Called with the page count once a PDF has been read, or null when it cannot be counted. */
  onPages?: (pages: number | null) => void;
  error?: string;
  variant?: 'site' | 'console';
  id?: string;
}

export function FileDrop({ file, onChange, onPages, error, variant = 'site', id = 'document' }: FileDropProps) {
  const [dragging, setDragging] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [edited, setEdited] = useState(false);
  const pdf = usePdf(file, onPages);
  const isConsole = variant === 'console';

  const choose = (f: File | null) => {
    setEdited(false);
    setStudioOpen(false);
    onChange(f);
  };

  if (file) {
    const doc = pdf?.status === 'ready' ? pdf.doc : null;
    return (
      <div className="file-wrap">
        <div className={isConsole ? 'c-file' : 'file-chip'}>
          {doc ? <CoverThumb doc={doc} /> : <Icon.File width={26} height={26} />}
          <div>
            <div className={isConsole ? undefined : 'file-chip__name'}>
              {isConsole ? <strong>{file.name}</strong> : file.name}
            </div>
            <small className={isConsole ? undefined : 'file-chip__meta'}>
              {ACCEPTED_FILE_TYPES[file.type] ?? 'File'} · {formatBytes(file.size)}
              {pdf?.status === 'reading' && ' · Counting pages…'}
              {doc && ` · ${doc.numPages} ${doc.numPages === 1 ? 'page' : 'pages'}`}
              {edited && <span className="file-badge">Edited</span>}
            </small>
          </div>
          <span className="file-actions">
            {doc && (
              <button type="button" className={isConsole ? 'c-btn c-btn--primary c-btn--small' : 'btn btn--primary btn--small'} onClick={() => setStudioOpen(true)}>
                <Icon.Eye width={16} height={16} />
                Preview &amp; edit
              </button>
            )}
            <button type="button" className={isConsole ? 'c-btn c-btn--quiet c-btn--small' : 'btn btn--outline btn--small'} onClick={() => choose(null)}>
              Replace
            </button>
          </span>
        </div>
        {pdf?.status === 'locked' && (
          <p className={isConsole ? 'hint' : 'form-note'}>This PDF is password-protected, so it can’t be previewed here. Enter the page count yourself; we’ll confirm it on arrival.</p>
        )}
        {pdf?.status === 'unreadable' && (
          <p className={isConsole ? 'hint' : 'form-note'}>We couldn’t read this PDF in your browser. Enter the page count yourself; we’ll confirm it on arrival.</p>
        )}
        {doc && studioOpen && (
          <PdfStudio
            doc={doc}
            file={file}
            onClose={() => setStudioOpen(false)}
            onSave={(next) => {
              setStudioOpen(false);
              setEdited(true);
              onChange(next);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor={id}
        className={`${isConsole ? 'c-drop' : 'drop'}${dragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) choose(f);
        }}
      >
        <Icon.Upload width={30} height={30} />
        {isConsole ? <strong>Drop your document here, or browse</strong> : <span className="drop__title">Drop your document here, or browse</span>}
        <span className={isConsole ? undefined : 'drop__hint'}>PDF, Word, PNG or JPEG, up to {MAX_FILE_MB} MB. Encrypted on arrival.</span>
        <input
          id={id}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) choose(f);
            e.target.value = '';
          }}
        />
      </label>
      {error && <p className={isConsole ? 'c-error' : 'field-error'} style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
