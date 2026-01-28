/**
 * GET /api/action/reschedule?token=xxx
 * Public action link redirecting patients to a rescheduling interface
 * Note: This is a simplified version that shows a message.
 * In production, this could redirect to a full scheduling UI.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase';
import type { ActionLinkResponse } from '../../lib/types';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse<ActionLinkResponse>
) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Missing or invalid token'
            });
        }

        // Validate the token using the database function
        const { data: validationData, error: validationError } = await supabaseAdmin
            .rpc('validate_action_token', { p_token: token });

        if (validationError || !validationData || validationData.length === 0) {
            console.error('Token validation error:', validationError);
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        const validation = validationData[0];

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.error_message || 'Invalid token'
            });
        }

        // Verify action type
        if (validation.action_type !== 'reschedule') {
            return res.status(400).json({
                success: false,
                message: 'Invalid action type for this endpoint'
            });
        }

        // Mark token as used so it can't be reused
        const { error: tokenError } = await supabaseAdmin
            .rpc('mark_token_used', { p_token: token });

        if (tokenError) {
            console.error('Error marking token as used:', tokenError);
            // Don't fail the request
        }

        // Update workflow status to indicate patient clicked reschedule
        const { error: workflowError } = await supabaseAdmin
            .from('whatsapp_workflows')
            .update({
                response: 'clicked reschedule link',
                responded_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('appointment_id', validation.appointment_id)
            .in('workflow_type', ['reschedule_no_show', 'reschedule_patient_cancel'])
            .eq('status', 'sent');

        if (workflowError) {
            console.error('Error updating workflow:', workflowError);
            // Don't fail the request
        }

        // Return instruction HTML page
        // In a real implementation, you could:
        // 1. Redirect to your main app's scheduling page with a pre-filled patient ID
        // 2. Show an inline calendar widget
        // 3. Send them back to WhatsApp with instructions
        return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reagendar Consulta</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            color: #3b82f6;
            margin-bottom: 10px;
            font-size: 28px;
          }
          p {
            color: #6b7280;
            font-size: 16px;
            line-height: 1.5;
          }
          .info-box {
            margin-top: 24px;
            padding: 16px;
            background: #dbeafe;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
          }
          .info-box p {
            color: #1e40af;
            margin: 0;
            font-size: 14px;
            font-weight: 500;
          }
          .whatsapp-button {
            margin-top: 24px;
            display: inline-block;
            padding: 14px 28px;
            background: #25d366;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">📅</div>
          <h1>Reagendar Consulta</h1>
          <p>Para reagendar sua consulta, por favor entre em contato conosco.</p>
          <div class="info-box">
            <p>💬 Responda à nossa mensagem no WhatsApp com suas preferências de data e horário.</p>
          </div>
          <p style="margin-top: 20px; font-size: 14px; color: #9ca3af;">Em breve entraremos em contato para confirmar o novo horário.</p>
        </div>
      </body>
      </html>
    `);
    } catch (error) {
        console.error('Action link error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}
