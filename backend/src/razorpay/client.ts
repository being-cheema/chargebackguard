import { getRazorpayConfig } from '../config/settings';

export class RazorpayApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body?: unknown
  ) {
    super(message);
    this.name = 'RazorpayApiError';
  }
}

export function getRazorpayAuthHeader(): string {
  const { keyId, keySecret } = getRazorpayConfig();
  if (!keyId || !keySecret) {
    throw new RazorpayApiError('Razorpay API credentials are not configured.', 503);
  }
  const token = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  return `Basic ${token}`;
}

export async function razorpayRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `https://api.razorpay.com${path}`;
  const headers: Record<string, string> = {
    Authorization: getRazorpayAuthHeader(),
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!res.ok) {
    const message =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as { error: { description?: string } }).error?.description || res.statusText)
        : res.statusText;
    throw new RazorpayApiError(message, res.status, parsed);
  }

  return parsed as T;
}
