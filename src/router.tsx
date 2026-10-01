import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';

function parseHash(): string {
  const h = location.hash.replace(/^#/, '');
  return h || '/';
}

/** Query-string params from the current hash (e.g. "#/labels?product=1" -> {product: "1"}). */
export function useQueryParams(): URLSearchParams {
  const [search, setSearch] = useState(location.hash.split('?')[1] ?? '');
  useEffect(() => {
    const onHash = () => setSearch(location.hash.split('?')[1] ?? '');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return new URLSearchParams(search);
}

export function useRoute(routes: { path: string; component: ComponentType<any> }[]) {
  const [path, setPath] = useState(parseHash().split('?')[0]);

  useEffect(() => {
    const onHash = () => setPath(parseHash().split('?')[0]);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  for (const route of routes) {
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' + route.path.replace(/:[a-zA-Z]+/g, (m) => {
        keys.push(m.slice(1));
        return '([^/]+)';
      }) + '$'
    );
    const match = path.match(pattern);
    if (match) {
      const params: Record<string, string> = {};
      keys.forEach((k, i) => (params[k] = decodeURIComponent(match[i + 1])));
      return { Component: route.component, params };
    }
  }
  return null;
}

export function navigate(path: string) {
  location.hash = '#' + path;
}
