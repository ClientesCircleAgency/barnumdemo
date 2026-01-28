/**
 * Security utilities for webhook verification
 */

import crypto from 'crypto';

/**
 * Verify HMAC signature from n8n webhook requests
 * @param payload - The request body as string
 * @param signature - The signature from the request header
 * @param secret - The webhook secret
 * @returns true if signature is valid
 */
export function verifyHmacSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Use timingSafeEqual to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

/**
 * Generate HMAC signature for outbound webhook requests to n8n
 * @param payload - The payload object to sign
 * @param secret - The webhook secret
 * @returns HMAC signature hex string
 */
export function generateHmacSignature(
    payload: Record<string, any>,
    secret: string
): string {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    return hmac.digest('hex');
}

/**
 * Generate idempotency key for webhook requests
 * @param eventId - The event ID
 * @param timestamp - ISO timestamp
 * @returns Idempotency key string
 */
export function generateIdempotencyKey(
    eventId: string,
    timestamp: string
): string {
    return `${eventId}-${new Date(timestamp).getTime()}`;
}
