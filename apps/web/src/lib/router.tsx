import { createContext, useCallback, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

// A small history-API router: enough for this app without another dependency.

interface Location {
  path: string;
  search: string;
  hash: string;
}

interface NavigateOptions {
  replace?: boolean;
}

interface RouterValue extends Location {
  navigate: (to: string, options?: NavigateOptions) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

function readLocation(): Location {
  const { pathname, search, hash } = window.location;
  return { path: pathname.replace(/\/+$/, '') || '/', search, hash };
}

function scrollToHash(hash: string): void {
  if (!hash) {
    window.scrollTo(0, 0);
    return;
  }
  requestAnimationFrame(() => {
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Location>(readLocation);

  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string, { replace = false }: NavigateOptions = {}) => {
    if (/^https?:\/\//.test(to)) {
      window.location.assign(to);
      return;
    }
    const url = new URL(to, window.location.href);
    const samePage = url.pathname === window.location.pathname && url.search === window.location.search;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
    setLocation(readLocation());
    if (samePage && url.hash) scrollToHash(url.hash);
    else if (url.hash) setTimeout(() => scrollToHash(url.hash), 60);
    else window.scrollTo(0, 0);
  }, []);

  const value = useMemo<RouterValue>(() => ({ ...location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>.');
  return ctx;
}

export function useQuery(): URLSearchParams {
  const { search } = useRouter();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export type RouteParams = Record<string, string>;

export function matchPath(pattern: string, path: string): RouteParams | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: RouteParams = {};
  for (let i = 0; i < p.length; i += 1) {
    const segment = p[i]!;
    const actual = s[i]!;
    if (segment.startsWith(':')) params[segment.slice(1)] = decodeURIComponent(actual);
    else if (segment !== actual) return null;
  }
  return params;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string;
  replace?: boolean;
};

export function Link({ to, children, onClick, replace, ...rest }: LinkProps) {
  const { navigate, path } = useRouter();
  const isCurrent = !to.includes('#') && to.split('?')[0] === path;
  return (
    <a
      href={to}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target) return;
        e.preventDefault();
        navigate(to, { replace });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export function Redirect({ to }: { to: string }) {
  const { navigate } = useRouter();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
}
