/**
 * POST /api/webhook
 * Unified webhook endpoint for n8n to send callbacks to Barnum
 * Handles all webhook actions via body.action parameter
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './lib/supabase';
import { verifyHmacSignature } from './lib/security';
import type { WebhookResponse } from './lib/types';

type WebhookAction =
    | 'confirm'
    | 'cancel'
    | 'reschedule'
    | 'no_show_reschedule'
    | 'reactivation'
    | 'review';

interface WebhookPayload {
    action: WebhookAction;
    appointmentId?: string;
    patientId?: string;
    patientResponse?: string;
    reason?: string;
    newDate?: string;
    newTime?: string;
    attempt?: number;
    workflowType?: string;
    reviewSubmitted?: boolean;
    rating?: number;
}

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

        const body: WebhookPayload = req.body;

        if (!body.action) {
            return res.status(400).json({
                success: false,
                error: 'Missing action parameter'
            });
        }

        // Route to appropriate handler based on action
        switch (body.action) {
            case 'confirm':
                return await handleConfirm(body, res);
            case 'cancel':
                return await handleCancel(body, res);
            case 'reschedule':
                return await handleReschedule(body, res);
            case 'no_show_reschedule':
                return await handleNoShowReschedule(body, res);
            case 'reactivation':
                return await handleReactivation(body, res);
            case 'review':
                return await handleReview(body, res);
            default:
                return res.status(400).json({
                    success: false,
                    error: `Unknown action: ${body.action}`
                });
        }
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}

async function handleConfirm(payload: WebhookPayload, res: VercelResponse<WebhookResponse>) {
    if (!payload.appointmentId) {
        return res.status(400).json({ success: false, error: 'Missing appointmentId' });
    }

    const { data: appointment, error: updateError } = await supabaseAdmin
        .from('appointments')
        .update({
            status: 'confirmed',
            updated_at: new Date().toISOString()
        })
        .eq('id', payload.appointmentId)
        .select()
        .single();

    if (updateError) {
        console.error('Error updating appointment:', updateError);
        return res.status(500).json({ success: false, error: 'Failed to update appointment' });
    }

    await supabaseAdmin
        .from('whatsapp_workflows')
        .update({
            status: 'completed',
            response: payload.patientResponse || 'confirmed',
            responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('appointment_id', payload.appointmentId)
        .eq('workflow_type', 'confirmation_24h')
        .eq('status', 'sent');

    return res.status(200).json({
        success: true,
        message: 'Appointment confirmed successfully',
        data: { appointment }
    });
}

async function handleCancel(payload: WebhookPayload, res: VercelResponse<WebhookResponse>) {
    if (!payload.appointmentId) {
        return res.status(400).json({ success: false, error: 'Missing appointmentId' });
    }

    const { data: appointment, error: updateError } = await supabaseAdmin
        .from('appointments')
        .update({
            status: 'cancelled',
            notes: payload.reason || null,
            updated_at: new Date().toISOString()
        })
        .eq('id', payload.appointmentId)
        .select()
        .single();

    if (updateError) {
        console.error('Error updating appointment:', updateError);
        return res.status(500).json({ success: false, error: 'Failed to cancel appointment' });
    }

    await supabaseAdmin
        .from('whatsapp_workflows')
        .update({
            status: 'cancelled',
            response: payload.reason || 'cancelled',
            responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('appointment_id', payload.appointmentId)
        .eq('status', 'sent');

    return res.status(200).json({
        success: true,
        message: 'Appointment cancelled successfully',
        data: { appointment }
    });
}

async function handleReschedule(payload: WebhookPayload, res: VercelResponse<WebhookResponse>) {
    if (!payload.appointmentId || !payload.newDate || !payload.newTime) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const { data: appointment, error: updateError } = await supabaseAdmin
        .from('appointments')
        .update({
            date: payload.newDate,
            time: payload.newTime,
            updated_at: new Date().toISOString()
        })
        .eq('id', payload.appointmentId)
        .select()
        .single();

    if (updateError) {
        console.error('Error updating appointment:', updateError);
        return res.status(500).json({ success: false, error: 'Failed to reschedule appointment' });
    }

    await supabaseAdmin
        .from('whatsapp_workflows')
        .update({
            status: 'completed',
            response: 'rescheduled',
            responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('appointment_id', payload.appointmentId)
        .eq('status', 'sent');

    return res.status(200).json({
        success: true,
        message: 'Appointment rescheduled successfully',
        data: { appointment }
    });
}

async function handleNoShowReschedule(payload: WebhookPayload, res: VercelResponse<WebhookResponse>) {
    if (!payload.appointmentId) {
        return res.status(400).json({ success: false, error: 'Missing appointmentId' });
    }

    await supabaseAdmin
        .from('whatsapp_workflows')
        .update({
            status: 'completed',
            response: `no_show_reschedule_attempt_${payload.attempt || 1}`,
            responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('appointment_id', payload.appointmentId)
        .eq('workflow_type', 'reschedule_prompt')
        .eq('status', 'sent');

    return res.status(200).json({
        success: true,
        message: 'No-show reschedule recorded'
    });
}

async function handleReactivation(payload: WebhookPayload, res: VercelResponse<WebhookResponse>) {
    if (!payload.patientId) {
        return res.status(400).json({ success: false, error: 'Missing patientId' });
    }

    // Create workflow record for reactivation
    const { error } = await supabaseAdmin
        .from('whatsapp_workflows')
        .insert({
            patient_id: payload.patientId,
            phone: '', // Will be populated by trigger
            workflow_type: payload.workflowType || 'reactivation',
            status: 'completed',
            responded_at: new Date().toISOString(),
            scheduled_at: new Date().toISOString()
        });

    if (error) {
        console.error('Error recording reactivation:', error);
        return res.status(500).json({ success: false, error: 'Failed to record reactivation' });
    }

    return res.status(200).json({
        success: true,
        message: 'Reactivation recorded successfully'
    });
}

async function handleReview(payload: WebhookPayload, res: VercelResponse<WebhookResponse>) {
    if (!payload.appointmentId) {
        return res.status(400).json({ success: false, error: 'Missing appointmentId' });
    }

    await supabaseAdmin
        .from('whatsapp_workflows')
        .update({
            status: 'completed',
            response: payload.reviewSubmitted ? `review_submitted_${payload.rating}` : 'review_declined',
            responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('appointment_id', payload.appointmentId)
        .eq('workflow_type', 'confirmation_24h')
        .eq('status', 'sent');

    return res.status(200).json({
        success: true,
        message: 'Review response recorded'
    });
}
