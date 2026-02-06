/**
 * POST /api/n8n/process-events
 * 
 * n8n-callable endpoint to process pending whatsapp_events.
 * n8n decides WHEN to call this (e.g., every 5 minutes on n8n's schedule).
 * 
 * Backend does NOT own timing. This is a reactive endpoint.
 * 
 * Auth: Requires N8N_WEBHOOK_SECRET in x-n8n-secret header
 * 
 * Request: POST with empty body or {}
 * Response: { success: boolean, processed: number, failed: number, errors?: string[] }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processWhatsAppEvents } from '../lib/internal-processor';

interface ProcessEventsResponse {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse<ProcessEventsResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      processed: 0,
      failed: 0,
      errors: ['Method not allowed']
    });
  }

  try {
    // Validate n8n webhook secret
    const n8nSecret = process.env.N8N_WEBHOOK_SECRET;
    const providedSecret = req.headers['x-n8n-secret'] as string;

    if (!n8nSecret || providedSecret !== n8nSecret) {
      return res.status(401).json({
        success: false,
        processed: 0,
        failed: 0,
        errors: ['Unauthorized']
      });
    }

    // Process events using shared processor
    const result = await processWhatsAppEvents();

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('n8n process-events error:', error);
    return res.status(500).json({
      success: false,
      processed: 0,
      failed: 0,
      errors: [error instanceof Error ? error.message : 'Internal server error']
    });
  }
}
