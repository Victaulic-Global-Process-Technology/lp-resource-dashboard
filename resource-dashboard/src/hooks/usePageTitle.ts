import { useEffect } from 'react';

const BASE_TITLE = 'Resource Dashboard';

export function usePageTitle(page: string) {
  useEffect(() => {
    document.title = page ? `${page} · ${BASE_TITLE}` : BASE_TITLE;
  }, [page]);
}
