import { toast } from "sonner";

/**
 * Download a file from a URL using fetch + blob.
 * This works reliably across all environments (including production proxies)
 * where <a download> attributes are ignored for cross-origin or proxy URLs.
 */
export async function downloadFile(url, fallbackFilename = "download") {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const blob = await response.blob();

    // Extract filename from Content-Disposition header if available
    const disposition = response.headers.get("Content-Disposition");
    let filename = fallbackFilename;
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, "");
      }
    }

    // Create a blob URL and trigger download via a temporary anchor
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 200);
  } catch (error) {
    toast.error("Download failed. Please try again.");
  }
}
