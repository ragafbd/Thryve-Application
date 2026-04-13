import { toast } from "sonner";

/**
 * Download a file reliably across all environments.
 * Uses window.location.href as primary method (most proxy-compatible),
 * with fetch+blob as fallback.
 */
export async function downloadFile(url, fallbackFilename = "download") {
  // Method 1: Direct navigation - most reliable across proxies
  // The backend returns Content-Disposition: attachment which forces download
  try {
    // Use a hidden iframe to avoid navigating away from the current page
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;
    document.body.appendChild(iframe);

    // Clean up after 30 seconds
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch (e) { /* ignore */ }
    }, 30000);

    return;
  } catch (e) {
    // If iframe fails, try fetch+blob
  }

  // Method 2: Fetch + Blob fallback
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition");
    let filename = fallbackFilename;
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) filename = match[1].replace(/['"]/g, "");
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 200);
  } catch (err) {
    // Method 3: Last resort - open in new tab
    window.open(url, "_blank");
  }
}
