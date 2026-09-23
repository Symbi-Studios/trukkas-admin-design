export function getApiErrorMessage(error) {
  if (error?.status === 'FETCH_ERROR') return 'Could not reach the Trukkas API. Check your connection and try again.';
  const message = error?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string' && message.trim()) return message;
  if (typeof error?.error === 'string' && error.error.trim() && error.status === 'CUSTOM_ERROR') return error.error;
  if (error?.status === 401) return 'Your session has ended. Please sign in again.';
  return 'The request failed. Please try again.';
}
