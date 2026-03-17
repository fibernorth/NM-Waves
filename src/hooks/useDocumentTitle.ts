import { useEffect } from 'react';

const BASE_TITLE = 'TC Waves Ball Club';

/**
 * Sets document.title on mount and restores on unmount.
 * Usage: useDocumentTitle('About Us')  →  "About Us | TC Waves Ball Club"
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
