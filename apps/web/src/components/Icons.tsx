import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const Icon = {
  Lock: (p: IconProps) => (
    <svg {...base} {...p}>
      <rect x="4.5" y="11" width="15" height="9.5" rx="1.5" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </svg>
  ),
  Clock: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  Seal: (p: IconProps) => (
    <svg {...base} {...p}>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  ),
  Upload: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </svg>
  ),
  File: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M14 3v5h5" />
    </svg>
  ),
  Check: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  ArrowLeft: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  ArrowRight: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  Pause: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M9 6v12M15 6v12" />
    </svg>
  ),
  Play: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M8 5.5v13l10-6.5z" />
    </svg>
  ),
  Menu: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  Close: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  Grid: (p: IconProps) => (
    <svg {...base} {...p}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
    </svg>
  ),
  List: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </svg>
  ),
  Plus: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Printer: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M7 9V4h10v5" />
      <rect x="3.5" y="9" width="17" height="8" rx="1.5" />
      <path d="M7 14h10v6H7z" />
    </svg>
  ),
  Settings: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  Sun: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </svg>
  ),
  Moon: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  ),
  SignOut: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16l-4-4 4-4M6 12h10" />
    </svg>
  ),
  Download: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4 19.5h16" />
    </svg>
  ),
  Receipt: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2zM9 8h6M9 11.5h6M9 15h3.5" />
    </svg>
  ),
  ArrowUp: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  ),
  ArrowDown: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  ),
  Minus: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M5 12h14" />
    </svg>
  ),
  RotateRight: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9" />
      <path d="M19.5 4v5h-5" />
    </svg>
  ),
  RotateLeft: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
      <path d="M4.5 4v5h5" />
    </svg>
  ),
  Undo: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  ),
  Trash: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7M10 11v6M14 11v6" />
    </svg>
  ),
  Phone: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M5.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 7 7l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 3.5 5.5a2 2 0 0 1 2-2z" />
    </svg>
  ),
  Mail: (p: IconProps) => (
    <svg {...base} {...p}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  ),
  Truck: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </svg>
  ),
  Users: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19.5a6 6 0 0 1 12 0M15.5 5a3 3 0 0 1 0 6M18 14.2a5.5 5.5 0 0 1 3 5.3" />
    </svg>
  ),
  Eye: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  )
};
