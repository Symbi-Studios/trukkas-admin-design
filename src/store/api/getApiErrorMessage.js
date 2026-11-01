function readableBodyMessage(data) {
  if (typeof data === 'string') {
    const message = data.trim();
    if (message && message.length <= 500 && !/<\s*(?:!doctype|html|head|body)[\s>]/i.test(message)) {
      return message;
    }
    return null;
  }

  if (!data || typeof data !== 'object') return null;
  if (data.data && typeof data.data === 'object' && data.data !== data) return readableBodyMessage(data.data) || readableBodyMessage({ ...data, data: null });

  for (const value of [data.message, data.detail, data.error_description, data.error]) {
    if (Array.isArray(value)) {
      const message = value.filter((item) => typeof item === 'string').join(' ').trim();
      if (message) return message;
    }
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
}

// Preserve useful validation messages, but do not expose implementation details.
export function userFacingMessage(message, fallback = 'The request could not be completed. Please try again.') {
  if (typeof message !== 'string' || !message.trim()) return fallback;
  const value = message.trim();
  if (/\b(?:API|backend|endpoint|payload|schema|metadata|pagination|idempotency|identifier|server|fetch|database|prisma|stack trace|TypeError|SyntaxError|HTTP\s*\d|response (?:is missing|is incomplete|is invalid|was|did not|returned|contains|has|could not|does not|ended|needs)|collection (?:is|was|could|contains|exceeds|changed|ended|returned))\b/i.test(value)) {
    if (/sent|submitted|confirm|saved|save|updated|write/i.test(value)) return 'The result could not be confirmed. Refresh and check before trying again.';
    return fallback;
  }
  return value;
}

export function getApiErrorMessage(error, fallback = 'The request could not be completed. Please try again.') {
  if (error?.status === 'FETCH_ERROR') {
    return 'Could not connect. Check your connection, then refresh and check before trying again.';
  }

  const serverMessage = readableBodyMessage(error?.data);
  if (serverMessage) return userFacingMessage(serverMessage, fallback);

  if (error?.status === 'PARSING_ERROR') {
    return 'The result could not be read. Refresh and check before trying again.';
  }
  if (error?.status === 'TIMEOUT_ERROR') return 'The request timed out. Refresh and check before trying again.';
  if (error?.status === 'CUSTOM_ERROR' && typeof error.error === 'string' && error.error.trim()) {
    return userFacingMessage(error.error, fallback);
  }
  if (error instanceof Error) return userFacingMessage(error.message, fallback);
  if (typeof error?.error === 'string' && error.error.trim()) return userFacingMessage(error.error, fallback);
  if (typeof error?.message === 'string' && error.message.trim()) return userFacingMessage(error.message, fallback);
  if (typeof error?.status === 'number') return fallback;
  return fallback;
}
