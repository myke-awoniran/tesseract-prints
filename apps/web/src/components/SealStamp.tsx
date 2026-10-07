// Shown once, when payment is confirmed: the tesseract mark stamps in and its frame draws itself.
export function SealStamp() {
  return (
    <svg className="seal-stamp" viewBox="0 0 180 180" aria-hidden="true">
      <rect x="6" y="6" width="168" height="168" rx="36" fill="#2B1442" />
      <g fill="none" stroke="#D9CCEB" strokeWidth="1.6" strokeLinejoin="round">
        <rect className="seal-ring" x="34" y="34" width="112" height="112" rx="4" />
        <path d="M34 34l22 22M146 34l-22 22M34 146l22-22M146 146l-22-22" opacity="0.7" />
      </g>
      <path d="M66 92l16 16 34-36" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
