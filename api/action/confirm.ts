/**
 * GET /api/action/confirm?token=xxx
 * Public action link for patients to confirm appointments via WhatsApp link
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
        if (validation.action_type !== 'confirm') {
            return res.status(400).json({
                success: false,
                message: 'Invalid action type for this endpoint'
            });
        }

        // Update appointment status to 'confirmed'
        const { error: updateError } = await supabaseAdmin
            .from('appointments')
            .update({
                status: 'confirmed',
                updated_at: new Date().toISOString()
            })
            .eq('id', validation.appointment_id);

        if (updateError) {
            console.error('Error updating appointment:', updateError);
            return res.status(500).json({
                success: false,
                message: 'Failed to confirm appointment'
            });
        }

        // Mark token as used
        const { error: tokenError } = await supabaseAdmin
            .rpc('mark_token_used', { p_token: token });

        if (tokenError) {
            console.error('Error marking token as used:', tokenError);
            // Don't fail the request
        }

        // Update workflow status
        const { error: workflowError } = await supabaseAdmin
            .from('whatsapp_workflows')
            .update({
                status: 'completed',
                response: 'confirmed via link',
                responded_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('appointment_id', validation.appointment_id)
            .in('workflow_type', ['confirmation_24h', 'pre_confirmation'])
            .eq('status', 'sent');

        if (workflowError) {
            console.error('Error updating workflow:', workflowError);
            // Don't fail the request
        }

        // Return success HTML page
        return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Consulta Confirmada</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
          }
          .success-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            color: #10b981;
            margin-bottom: 10px;
            font-size: 28px;
          }
          p {
            color: #6b7280;
            font-size: 16px;
            line-height: 1.5;
          }
          .button {
            margin-top: 30px;
            display: inline-block;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Consulta Confirmada!</h1>
          <p>Sua consulta foi confirmada com sucesso. Aguardamos você no horário marcado.</p>
          <p style="margin-top: 20px; font-size: 14px; color: #9ca3af;">Você pode fechar esta janela.</p>
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
