/**
 * POST /api/webhooks/reviews/record
 * Webhook endpoint for n8n to record patient review/feedback after appointment
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase';
import { verifyHmacSignature } from '../../lib/security';
import type { WebhookResponse } from '../../lib/types';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse<WebhookResponse>
) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        // Verify HMAC signature if webhook secret is configured
        const signature = req.headers['x-webhook-signature'] as string;
        const webhookSecret = process.env.WEBHOOK_SECRET;

        if (webhookSecret && signature) {
            const payload = JSON.stringify(req.body);
            const isValid = verifyHmacSignature(payload, signature, webhookSecret);

            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid signature'
                });
            }
        }

        // Extract data from request
        const {
            appointmentId,
            patientId,
            rating,
            feedback,
            patientResponse
        } = req.body;

        if (!appointmentId && !patientId) {
            return res.status(400).json({
                success: false,
                error: 'Missing appointmentId or patientId'
            });
        }

        // Update the corresponding whatsapp_workflow record with the review
        const { error: workflowError } = await supabaseAdmin
            .from('whatsapp_workflows')
            .update({
                status: 'completed',
                response: patientResponse || JSON.stringify({ rating, feedback }),
                responded_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                message_payload: {
                    rating,
                    feedback
                }
            })
            .eq('appointment_id', appointmentId)
            .eq('workflow_type', 'review_2h')
            .eq('status', 'sent');

        if (workflowError) {
            console.error('Error updating workflow:', workflowError);
            return res.status(500).json({
                success: false,
                error: 'Failed to record review'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Review recorded successfully',
            data: { rating, feedback }
        });
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}
