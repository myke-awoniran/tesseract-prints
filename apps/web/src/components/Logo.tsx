// Tesseract Prints mark: a tesseract (four-dimensional cube) drawn as two nested squares joined at the corners.
interface MarkProps {
  size?: number;
  fill?: string;
  line?: string;
}

export function BrandMark({ size = 40, fill = '#FFFFFF', line = '#2B1442' }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="11" fill={fill} />
      <g fill="none" stroke={line} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
        <rect x="10.5" y="10.5" width="27" height="27" rx="1.5" />
        <rect x="18.5" y="18.5" width="11" height="11" rx="0.8" />
        <path d="M10.5 10.5l8 8M37.5 10.5l-8 8M10.5 37.5l8-8M37.5 37.5l-8-8" />
      </g>
    </svg>
  );
}

export function Wordmark({ size = 38, fill, line }: MarkProps) {
  return (
    <span className="wordmark">
      <BrandMark size={size} fill={fill} line={line} />
      <span className="wordmark__text">
        <span className="wordmark__name">Tesseract</span>
        <span className="wordmark__sub">Prints</span>
      </span>
    </span>
  );
}

export function FallbackMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true">
      <g fill="none" stroke="#fff" strokeWidth="0.8">
        <rect x="20" y="20" width="160" height="160" />
        <rect x="65" y="65" width="70" height="70" />
        <path d="M20 20l45 45M180 20l-45 45M20 180l45-45M180 180l-45-45" />
      </g>
    </svg>
  );
}
