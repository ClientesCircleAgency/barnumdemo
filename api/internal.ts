/**
 * POST /api/internal
 * Manual testing endpoint to process pending whatsapp_events
 * 
 * Auth: Requires INTERNAL_API_SECRET in Authorization: Bearer header
 * 
 * Note: In production, n8n calls /api/n8n/process-events (not this endpoint).
 *       This endpoint is for manual testing/debugging only.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processWhatsAppEvents } from './lib/internal-processor';

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
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            processed: 0,
            failed: 0,
            errors: ['Method not allowed']
        });
    }

    try {
        // Require Bearer token authentication
        const authHeader = req.headers['authorization'];
        const internalSecret = process.env.INTERNAL_API_SECRET;

        if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
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
        console.error('Process events error:', error);
        return res.status(500).json({
            success: false,
            processed: 0,
            failed: 0,
            errors: [error instanceof Error ? error.message : 'Internal server error']
        });
    }
}
