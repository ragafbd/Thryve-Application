/**
 * Download a file using fetch (carries existing Cloudflare cookies)
 * then triggers download via blob URL.
 */
export async function downloadFile(url, fallbackFilename = "download") {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) return;

  const blob = await response.blob();

  // Get filename from Content-Disposition header
  const disposition = response.headers.get("Content-Disposition");
  let filename = fallbackFilename;
  if (disposition) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) filename = match[1].replace(/['"]/g, "");
  }

  // Create blob URL and trigger download
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
}
