/**
 * POST /api/webhooks/appointments/reschedule
 * Webhook endpoint for n8n to reschedule an appointment after patient selects new time
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
        const { appointmentId, newDate, newTime, patientResponse } = req.body;

        if (!appointmentId || !newDate || !newTime) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: appointmentId, newDate, newTime'
            });
        }

        // Update appointment with new date and time
        const { data: appointment, error: updateError } = await supabaseAdmin
            .from('appointments')
            .update({
                date: newDate,
                time: newTime,
                status: 'scheduled', // Reset to scheduled after rescheduling
                updated_at: new Date().toISOString()
            })
            .eq('id', appointmentId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating appointment:', updateError);
            return res.status(500).json({
                success: false,
                error: 'Failed to update appointment'
            });
        }

        // Update the corresponding whatsapp_workflow record
        const { error: workflowError } = await supabaseAdmin
            .from('whatsapp_workflows')
            .update({
                status: 'completed',
                response: patientResponse || `rescheduled to ${newDate} ${newTime}`,
                responded_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('appointment_id', appointmentId)
            .in('workflow_type', ['reschedule_no_show', 'reschedule_patient_cancel'])
            .eq('status', 'sent');

        if (workflowError) {
            console.error('Error updating workflow:', workflowError);
            // Don't fail the request, this is a secondary operation
        }

        return res.status(200).json({
            success: true,
            message: 'Appointment rescheduled successfully',
            data: { appointment }
        });
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}
