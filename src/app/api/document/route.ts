import { getAccessToken } from '@/lib/auth/session';

// Shows a job document inside the admin page.
// Cloudinary sends these files as downloads, so the browser saves them instead of showing them.
// This route runs on the Next.js server: it fetches the file and sends it back marked "show in the page".
//   GET /api/document?url=<file url>&name=<file name>[&download=1]
// Only signed-in admins can use it, and only for files on the allowed hosts.

export const dynamic = 'force-dynamic';

const ALLOWED_HOSTS = (process.env.DOCUMENT_HOSTS ?? 'res.cloudinary.com')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

const MAX_BYTES = 25 * 1024 * 1024;

const EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// The backend gives us links and names without an extension, so we read the first bytes of the file itself.
function sniffType(bytes: Uint8Array): string | null {
  const startsWith = (text: string, offset = 0) => [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
  if (startsWith('%PDF-')) return 'application/pdf';
  if (bytes[0] === 0x89 && startsWith('PNG', 1)) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (startsWith('GIF8')) return 'image/gif';
  if (startsWith('RIFF') && startsWith('WEBP', 8)) return 'image/webp';
  return null;
}

function fail(status: number, message: string) {
  return Response.json({ message }, { status });
}

function safeName(value: string | null, fallback: string): string {
  const cleaned = (value ?? '').replace(/[^\w.\- ()]/g, '_').slice(0, 120).trim();
  return cleaned || fallback;
}

export async function GET(request: Request) {
  if (!(await getAccessToken())) return fail(401, 'Sign in to view documents.');

  const params = new URL(request.url).searchParams;
  let target: URL;
  try {
    target = new URL(params.get('url') ?? '');
  } catch {
    return fail(400, 'A valid file link is required.');
  }
  if (target.protocol !== 'https:' || target.username || target.password || !ALLOWED_HOSTS.includes(target.hostname.toLowerCase())) {
    return fail(400, 'This file link is not allowed.');
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { cache: 'no-store', redirect: 'error' });
  } catch {
    return fail(502, 'The file could not be reached.');
  }
  if (!upstream.ok) return fail(upstream.status === 404 ? 404 : 502, 'The file could not be loaded.');
  if (Number(upstream.headers.get('content-length') ?? 0) > MAX_BYTES) return fail(413, 'This file is too large to show here.');

  const bytes = new Uint8Array(await upstream.arrayBuffer());
  if (bytes.length > MAX_BYTES) return fail(413, 'This file is too large to show here.');
  const type = sniffType(bytes);
  if (!type) return fail(415, 'This kind of file cannot be shown here.');

  const extension = EXTENSION[type];
  let name = safeName(params.get('name'), 'document');
  if (!name.toLowerCase().endsWith(`.${extension}`)) name = `${name}.${extension}`;

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Disposition': `${params.get('download') === '1' ? 'attachment' : 'inline'}; filename="${name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=300',
      'Content-Length': String(bytes.length),
    },
  });
}