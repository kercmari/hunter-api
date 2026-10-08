import { createHmac, timingSafeEqual } from 'crypto';

export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

export interface SignatureInput {
  readonly method: string;

  readonly uri: string;
  readonly rawBody: string;
  readonly signature?: string;
  readonly timestamp?: string;
  readonly clientSecret: string;
  readonly nowMs: number;
}

export interface SignatureResult {
  readonly valid: boolean;
  readonly reason?: string;
}

export function validateHubSpotSignature(input: SignatureInput): SignatureResult {
  if (!input.clientSecret) return { valid: false, reason: 'HUBSPOT_CLIENT_SECRET is not configured' };
  if (!input.signature) return { valid: false, reason: 'missing X-HubSpot-Signature-v3' };
  if (!input.timestamp) return { valid: false, reason: 'missing X-HubSpot-Request-Timestamp' };

  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp)) return { valid: false, reason: 'invalid timestamp' };
  if (input.nowMs - timestamp > SIGNATURE_MAX_AGE_MS) {
    return { valid: false, reason: 'expired timestamp, possible replay' };
  }

  const base = `${input.method}${input.uri}${input.rawBody}${input.timestamp}`;
  const expected = createHmac('sha256', input.clientSecret).update(base, 'utf8').digest('base64');

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(input.signature);
  if (expectedBuffer.length !== receivedBuffer.length) {
    return { valid: false, reason: 'signature mismatch' };
  }
  return timingSafeEqual(expectedBuffer, receivedBuffer)
    ? { valid: true }
    : { valid: false, reason: 'signature mismatch' };
}
