function getStoredPiHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem('pi_auth') || window.localStorage.getItem('ifiok_pi_auth');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { accessToken?: string; sessionToken?: string };
    const out: Record<string, string> = {};
    if (parsed.sessionToken) out.Authorization = `Bearer ${parsed.sessionToken}`;
    if (parsed.accessToken) out['x-pi-access-token'] = parsed.accessToken;
    return out;
  } catch {
    return {};
  }
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const isSameOriginApi = url.startsWith('/api/');
  const piHeaders = isSameOriginApi ? getStoredPiHeaders() : {};
  const headers: Record<string, string> = {
    ...piHeaders,
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    // Non-JSON response
  }

  if (!res.ok) {
    const message = typeof data.error === 'string' ? data.error : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
