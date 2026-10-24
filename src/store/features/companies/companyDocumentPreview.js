// Detect preview formats from the file bytes, including uploads with no extension
// or an application/octet-stream Content-Type. Never embed HTML or SVG uploads.
export async function companyDocumentPreviewBlob(blob) {
  const bytes = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
  const starts = (...signature) => signature.every((byte, index) => bytes[index] === byte);
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  let type = null;
  if (ascii(0, bytes.length).includes('%PDF-')) type = 'application/pdf';
  else if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) type = 'image/png';
  else if (starts(0xff, 0xd8, 0xff)) type = 'image/jpeg';
  else if (['GIF87a', 'GIF89a'].includes(ascii(0, 6))) type = 'image/gif';
  else if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') type = 'image/webp';
  if (!type) throw new Error('This file format cannot be previewed. Open file to download the original.');
  return blob.slice(0, blob.size, type);
}
