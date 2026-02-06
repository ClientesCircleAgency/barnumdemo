/**
 * Shared WhatsApp Event Processor
 * 
 * This module contains the core logic for processing pending whatsapp_events.
 * It's used by:
 * - api/n8n/process-events.ts (n8n calls this on its schedule)
 * - api/internal.ts (Manual testing with Bearer token auth)
 * 
 * Note: Backend does NOT decide when to process. n8n is the scheduler.
 */

import { supabaseAdmin } from './supabase';
import { generateHmacSignature, generateIdempotencyKey } from './security';

export interface ProcessEventsResult {
  processed: number;
  failed: number;
  errors?: string[];
}

export async function processWhatsAppEvents(): Promise<ProcessEventsResult> {
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_BASE_URL;
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!n8nWebhookUrl) {
    throw new Error('N8N_WEBHOOK_BASE_URL not configured');
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
    throw new Error('Failed to fetch events');
  }

  if (!pendingEvents || pendingEvents.length === 0) {
    return {
      processed: 0,
      failed: 0
    };
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

  return {
    processed,
    failed,
    ...(errors.length > 0 && { errors })
  };
}
