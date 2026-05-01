/**
 * Download a file by opening it in a new window.
 * This is required because the app runs inside a sandboxed iframe
 * that blocks downloads. A new window is NOT sandboxed.
 */
export function downloadFile(url) {
  window.open(url, '_blank');
}
