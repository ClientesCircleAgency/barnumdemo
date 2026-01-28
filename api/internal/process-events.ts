/**
 * POST /api/internal/process-events
 * Internal endpoint to process pending whatsapp_events and send to n8n
 * This should be called by:
 * 1. A scheduled CRON job (every 1-5 minutes)
 * 2. A database trigger (for immediate processing)
 * 3. Manual trigger for testing
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase';
import { generateHmacSignature, generateIdempotencyKey } from '../../lib/security';

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
        // Optional: Add internal authentication
        const authHeader = req.headers['authorization'];
        const internalSecret = process.env.INTERNAL_API_SECRET;

        if (internalSecret && authHeader !== `Bearer ${internalSecret}`) {
            return res.status(401).json({
                success: false,
                processed: 0,
                failed: 0,
                errors: ['Unauthorized']
            });
        }

        const n8nWebhookUrl = process.env.N8N_WEBHOOK_BASE_URL;
        const webhookSecret = process.env.WEBHOOK_SECRET;

        if (!n8nWebhookUrl) {
            return res.status(500).json({
                success: false,
                processed: 0,
                failed: 0,
                errors: ['N8N_WEBHOOK_BASE_URL not configured']
            });
        }

        // Fetch pending events that are scheduled to be sent
        const { data: pendingEvents, error: fetchError } = await supabaseAdmin
            .from('whatsapp_events')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_for', new Date().toISOString())
            .order('created_at', { ascending: true })
            .limit(50); // Process in batches of 50

        if (fetchError) {
            console.error('Error fetching events:', fetchError);
            return res.status(500).json({
                success: false,
                processed: 0,
                failed: 0,
                errors: ['Failed to fetch events']
            });
        }

        if (!pendingEvents || pendingEvents.length === 0) {
            return res.status(200).json({
                success: true,
                processed: 0,
                failed: 0
            });
        }

        let processed = 0;
        let failed = 0;
        const errors: string[] = [];

        // Process each event
        for (const event of pendingEvents) {
            try {
                // Mark event as processing
                await supabaseAdmin
                    .from('whatsapp_events')
                    .update({ status: 'processing' })
                    .eq('id', event.id);

                // Generate HMAC signature
                const signature = webhookSecret
                    ? generateHmacSignature(event.payload, webhookSecret)
                    : undefined;

                // Generate idempotency key
                const idempotencyKey = generateIdempotencyKey(
                    event.id,
                    event.created_at
                );

                // Send to n8n webhook
                const webhookResponse = await fetch(n8nWebhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(signature && { 'X-Webhook-Signature': signature }),
                        'X-Idempotency-Key': idempotencyKey,
                        'X-Event-Id': event.id,
                        'X-Event-Type': event.event_type
                    },
                    body: JSON.stringify(event.payload)
                });

                if (!webhookResponse.ok) {
                    throw new Error(`Webhook returned status ${webhookResponse.status}`);
                }

                // Mark event as sent
                await supabaseAdmin
                    .from('whatsapp_events')
                    .update({
                        status: 'sent',
                        processed_at: new Date().toISOString()
                    })
                    .eq('id', event.id);

                // Update the corresponding workflow status
                if (event.workflow_id) {
                    await supabaseAdmin
                        .from('whatsapp_workflows')
                        .update({
                            status: 'sent',
                            sent_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', event.workflow_id);
                }

                processed++;
            } catch (error) {
                console.error(`Error processing event ${event.id}:`, error);

                const retryCount = event.retry_count + 1;
                const maxRetries = event.max_retries;

                if (retryCount >= maxRetries) {
                    // Move to dead letter
                    await supabaseAdmin
                        .from('whatsapp_events')
                        .update({
                            status: 'dead_letter',
                            retry_count: retryCount,
                            last_error: error instanceof Error ? error.message : 'Unknown error',
                            processed_at: new Date().toISOString()
                        })
                        .eq('id', event.id);

                    errors.push(`Event ${event.id} moved to dead_letter after ${retryCount} retries`);
                } else {
                    // Increment retry count and reset to pending for next attempt
                    await supabaseAdmin
                        .from('whatsapp_events')
                        .update({
                            status: 'pending',
                            retry_count: retryCount,
                            last_error: error instanceof Error ? error.message : 'Unknown error',
                            scheduled_for: new Date(Date.now() + retryCount * 60000).toISOString() // Exponential backoff
                        })
                        .eq('id', event.id);
                }

                failed++;
            }
        }

        return res.status(200).json({
            success: true,
            processed,
            failed,
            ...(errors.length > 0 && { errors })
        });
    } catch (error) {
        console.error('Process events error:', error);
        return res.status(500).json({
            success: false,
            processed: 0,
            failed: 0,
            errors: ['Internal server error']
        });
    }
}
