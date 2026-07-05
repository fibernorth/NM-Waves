import { useEffect } from 'react';

const BASE_TITLE = 'Northern Michigan Waves';

/**
 * Sets document.title on mount and restores on unmount.
 * Usage: useDocumentTitle('About Us')  →  "About Us | Northern Michigan Waves"
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
