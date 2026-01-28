/**
 * POST /api/webhooks/appointments/no-show-reschedule
 * Webhook endpoint for n8n to create a new appointment after no-show rescheduling
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
            originalAppointmentId,
            patientId,
            professionalId,
            specialtyId,
            consultationTypeId,
            newDate,
            newTime,
            duration,
            patientResponse
        } = req.body;

        if (!originalAppointmentId || !patientId || !newDate || !newTime) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Create new appointment for rescheduled no-show
        const { data: newAppointment, error: createError } = await supabaseAdmin
            .from('appointments')
            .insert({
                patient_id: patientId,
                professional_id: professionalId,
                specialty_id: specialtyId,
                consultation_type_id: consultationTypeId,
                date: newDate,
                time: newTime,
                duration: duration || 30,
                status: 'scheduled',
                notes: `Rescheduled from no-show appointment ${originalAppointmentId}`
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating appointment:', createError);
            return res.status(500).json({
                success: false,
                error: 'Failed to create new appointment'
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
            .eq('appointment_id', originalAppointmentId)
            .eq('workflow_type', 'reschedule_no_show')
            .eq('status', 'sent');

        if (workflowError) {
            console.error('Error updating workflow:', workflowError);
            // Don't fail the request, this is a secondary operation
        }

        return res.status(200).json({
            success: true,
            message: 'New appointment created successfully',
            data: { appointment: newAppointment }
        });
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}
