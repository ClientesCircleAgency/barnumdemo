/**
 * POST /api/webhooks/reactivation/record
 * Webhook endpoint for n8n to record patient response to reactivation campaign
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
            patientId,
            interested,
            patientResponse,
            workflowId
        } = req.body;

        if (!patientId) {
            return res.status(400).json({
                success: false,
                error: 'Missing patientId'
            });
        }

        // Update the corresponding whatsapp_workflow record
        const { error: workflowError } = await supabaseAdmin
            .from('whatsapp_workflows')
            .update({
                status: 'completed',
                response: patientResponse || (interested ? 'interested' : 'not interested'),
                responded_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                message_payload: {
                    interested,
                    response: patientResponse
                }
            })
            .eq('id', workflowId || '')
            .or(`patient_id.eq.${patientId}`)
            .eq('workflow_type', 'reactivation')
            .eq('status', 'sent');

        if (workflowError) {
            console.error('Error updating workflow:', workflowError);
            return res.status(500).json({
                success: false,
                error: 'Failed to record reactivation response'
            });
        }

        // If patient is interested, create an appointment request
        if (interested) {
            const { error: requestError } = await supabaseAdmin
                .from('appointment_requests')
                .insert({
                    patient_id: patientId,
                    status: 'pending',
                    notes: 'Created from reactivation campaign',
                    preferred_dates: []
                });

            if (requestError) {
                console.error('Error creating appointment request:', requestError);
                // Don't fail the main request
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Reactivation response recorded successfully',
            data: { interested, patientId }
        });
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}
