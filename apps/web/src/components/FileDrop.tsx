import { useState } from 'react';
import { ACCEPTED_EXTENSIONS, ACCEPTED_FILE_TYPES, MAX_FILE_BYTES, MAX_FILE_MB } from '@tesseract/shared';
import { formatBytes } from '../lib/format';
import { Icon } from './Icons';

export function checkFile(file: File | null): string {
  if (!file) return 'Choose a document to upload.';
  if (!ACCEPTED_FILE_TYPES[file.type]) return 'This file type is not supported. Upload a PDF, Word document, PNG or JPEG.';
  if (file.size > MAX_FILE_BYTES) return `Files can be up to ${MAX_FILE_MB} MB.`;
  if (file.size === 0) return 'This file is empty.';
  return '';
}

/** Drag-and-drop file input. `variant` switches between the site and console styles. */
interface FileDropProps {
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  variant?: 'site' | 'console';
  id?: string;
}

export function FileDrop({ file, onChange, error, variant = 'site', id = 'document' }: FileDropProps) {
  const [dragging, setDragging] = useState(false);
  const isConsole = variant === 'console';

  if (file) {
    return (
      <div className={isConsole ? 'c-file' : 'file-chip'}>
        <Icon.File width={26} height={26} />
        <div>
          <div className={isConsole ? undefined : 'file-chip__name'}>
            {isConsole ? <strong>{file.name}</strong> : file.name}
          </div>
          <small className={isConsole ? undefined : 'file-chip__meta'}>
            {ACCEPTED_FILE_TYPES[file.type] ?? 'File'} · {formatBytes(file.size)}
          </small>
        </div>
        <button type="button" className={isConsole ? 'c-btn c-btn--quiet c-btn--small' : 'btn btn--outline btn--small'} onClick={() => onChange(null)}>
          Replace
        </button>
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
          if (f) onChange(f);
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
            if (f) onChange(f);
            e.target.value = '';
          }}
        />
      </label>
      {error && <p className={isConsole ? 'c-error' : 'field-error'} style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
