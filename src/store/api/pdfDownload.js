function safePdfName(value) {
  if (typeof value !== 'string') return null;
  const name = value.split(/[\\/]/).pop().replace(/[<>:"|?*\x00-\x1f\x7f]/g, '').trim();
  return name && name.length <= 180 && !name.startsWith('.') && /\.pdf$/i.test(name) ? name : null;
}
export function pdfAttachmentFilename(headers, fallback) {
  const disposition = headers?.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*\s*=\s*UTF-8'[^']*'([^;]+)/i)?.[1];
  const plain = disposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  let name = null;
  if (encoded) { try { name = safePdfName(decodeURIComponent(encoded.trim())); } catch { /* Fall back to the plain filename. */ } }
  return name || safePdfName(plain?.[1] || plain?.[2]) || safePdfName(fallback) || 'document.pdf';
}
export async function isPdfAttachment(file) {
  return file instanceof Blob && file.type.split(';')[0].trim().toLowerCase() === 'application/pdf' && await file.slice(0, 5).text() === '%PDF-';
}
