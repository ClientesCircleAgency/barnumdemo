/**
 * POST /api/n8n/create-24h-confirmations
 * 
 * n8n-callable endpoint to create 24h confirmation workflows.
 * n8n decides WHEN to call this (e.g., daily at 08:00 to prepare next day's confirmations).
 * 
 * Backend does NOT own timing. This is a reactive endpoint.
 * 
 * Business Logic:
 * - Finds appointments scheduled 24-25 hours from now
 * - Creates pre-confirmation workflow + event ONCE per appointment (idempotent)
 * - Events will be processed by n8n calling /api/n8n/process-events
 * 
 * Auth: Requires N8N_WEBHOOK_SECRET in x-n8n-secret header
 * 
 * Request: POST with empty body or { targetDate?: 'YYYY-MM-DD' }
 * Response: { success: boolean, checked: number, created: number, skipped: number, errors?: string[] }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabase';

interface CreateConfirmationsRequest {
  targetDate?: string; // Optional: specify exact date to check (for testing)
}

interface CreateConfirmationsResponse {
  success: boolean;
  checked: number;
  created: number;
  skipped: number;
  errors?: string[];
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse<CreateConfirmationsResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      checked: 0,
      created: 0,
      skipped: 0,
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
        checked: 0,
        created: 0,
        skipped: 0,
        errors: ['Unauthorized']
      });
    }

    const body = req.body as CreateConfirmationsRequest;
    const now = new Date();

    // Calculate 24-hour window (23-25 hours from now for 2-hour buffer)
    // Or use provided targetDate for testing
    let windowStart: Date;
    let windowEnd: Date;

    if (body.targetDate) {
      // Testing mode: check specific date
      windowStart = new Date(body.targetDate);
      windowEnd = new Date(body.targetDate);
    } else {
      // Production mode: 24h window
      windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours
      windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25 hours
    }

    // Query appointments in the 24h window that need confirmation
    const { data: upcomingAppointments, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select('id, patient_id, date, time, status')
      .in('status', ['scheduled', 'pre_confirmed']) // Only unconfirmed appointments
      .gte('date', windowStart.toISOString().split('T')[0])
      .lte('date', windowEnd.toISOString().split('T')[0]);

    if (fetchError) {
      console.error('Error fetching upcoming appointments:', fetchError);
      return res.status(500).json({
        success: false,
        checked: 0,
        created: 0,
        skipped: 0,
        errors: ['Failed to fetch appointments']
      });
    }

    if (!upcomingAppointments || upcomingAppointments.length === 0) {
      return res.status(200).json({
        success: true,
        checked: 0,
        created: 0,
        skipped: 0
      });
    }

    let checked = 0;
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const apt of upcomingAppointments) {
      checked++;

      try {
        // Check if workflow already exists for this appointment (idempotency)
        const { data: existingWorkflow } = await supabaseAdmin
          .from('whatsapp_workflows')
          .select('id')
          .eq('appointment_id', apt.id)
          .eq('workflow_type', 'pre_confirmation')
          .maybeSingle();

        if (existingWorkflow) {
          skipped++;
          continue; // Already sent, skip
        }

        // Get patient phone number
        const { data: patient, error: patientError } = await supabaseAdmin
          .from('patients')
          .select('phone')
          .eq('id', apt.patient_id)
          .single();

        if (patientError || !patient) {
          errors.push(`No patient found for appointment ${apt.id}`);
          skipped++;
          continue;
        }

        // Create workflow (scheduled for immediate send)
        const { data: workflow, error: workflowError } = await supabaseAdmin
          .from('whatsapp_workflows')
          .insert({
            appointment_id: apt.id,
            patient_id: apt.patient_id,
            phone: patient.phone,
            workflow_type: 'pre_confirmation',
            scheduled_at: now.toISOString()
          })
          .select('id')
          .single();

        if (workflowError || !workflow) {
          errors.push(`Failed to create workflow for appointment ${apt.id}`);
          skipped++;
          continue;
        }

        // Create WhatsApp event (will be processed by n8n calling /api/n8n/process-events)
        const { error: eventError } = await supabaseAdmin
          .from('whatsapp_events')
          .insert({
            event_type: 'appointment.pre_confirmation',
            entity_type: 'appointment',
            entity_id: apt.id,
            workflow_id: workflow.id,
            payload: {
              appointment_id: apt.id,
              patient_id: apt.patient_id,
              date: apt.date,
              time: apt.time
            },
            status: 'pending',
            scheduled_for: now.toISOString()
          });

        if (eventError) {
          errors.push(`Failed to create event for appointment ${apt.id}`);
          skipped++;
        } else {
          created++;
        }
      } catch (error) {
        console.error(`Error processing appointment ${apt.id}:`, error);
        errors.push(`Appointment ${apt.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        skipped++;
      }
    }

    return res.status(200).json({
      success: true,
      checked,
      created,
      skipped,
      ...(errors.length > 0 && { errors })
    });
  } catch (error) {
    console.error('n8n create-24h-confirmations error:', error);
    return res.status(500).json({
      success: false,
      checked: 0,
      created: 0,
      skipped: 0,
      errors: ['Internal server error']
    });
  }
}
