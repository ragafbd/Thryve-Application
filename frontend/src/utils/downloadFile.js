/**
 * Download a file by navigating directly to the URL.
 * The backend returns Content-Disposition: attachment which
 * forces the browser to download without leaving the page.
 */
export function downloadFile(url) {
  window.location.href = url;
}
