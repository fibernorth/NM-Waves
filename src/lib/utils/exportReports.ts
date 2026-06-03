import toast from 'react-hot-toast';

/**
 * Format a number as a currency string for CSV export (no $ sign, just the number).
 */
export const fmtCurrencyCSV = (val: number): string =>
  val === 0 ? '0.00' : Math.abs(val).toFixed(2);

/**
 * Format a number as a display currency string with $ sign.
 */
export const fmtCurrencyDisplay = (val: number): string =>
  val === 0 ? '$0.00' : `$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Build a CSV string from headers and rows, create a Blob, and trigger a download.
 */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const escapeCell = (cell: string | number): string => {
    const str = String(cell);
    // Wrap in quotes if the cell contains commas, quotes, or newlines
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines: string[] = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(',')),
  ];

  const csvContent = csvLines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success('CSV exported successfully');
}
