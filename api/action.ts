/**
 * GET /api/action?type=confirm|cancel|reschedule&token=xxx
 * Unified public action link handler for patient interactions via WhatsApp links
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './lib/supabase';
import type { ActionLinkResponse } from './lib/types';

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
        const { type, token } = req.query;

        if (!type || typeof type !== 'string' || !['confirm', 'cancel', 'reschedule'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or missing action type. Must be: confirm, cancel, or reschedule'
            });
        }

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

        // Verify action type matches token
        if (validation.action_type !== type) {
            return res.status(400).json({
                success: false,
                message: 'Action type does not match token'
            });
        }

        // Handle action based on type
        switch (type) {
            case 'confirm':
                return await handleConfirm(validation, token, res);
            case 'cancel':
                return await handleCancel(validation, token, res);
            case 'reschedule':
                return await handleReschedule(validation, token, res);
        }
    } catch (error) {
        console.error('Action link error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

async function handleConfirm(validation: any, token: string, res: VercelResponse) {
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
    await supabaseAdmin.rpc('mark_token_used', { p_token: token });

    // Update workflow status
    await supabaseAdmin
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

    // Return success HTML page
    return res.status(200).send(generateHTML(
        'Consulta Confirmada!',
        '✅',
        'Sua consulta foi confirmada com sucesso. Aguardamos você no horário marcado.',
        '#10b981'
    ));
}

async function handleCancel(validation: any, token: string, res: VercelResponse) {
    // Update appointment status to 'cancelled'
    const { error: updateError } = await supabaseAdmin
        .from('appointments')
        .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
        })
        .eq('id', validation.appointment_id);

    if (updateError) {
        console.error('Error updating appointment:', updateError);
        return res.status(500).json({
            success: false,
            message: 'Failed to cancel appointment'
        });
    }

    // Mark token as used
    await supabaseAdmin.rpc('mark_token_used', { p_token: token });

    // Update workflow status
    await supabaseAdmin
        .from('whatsapp_workflows')
        .update({
            status: 'cancelled',
            response: 'cancelled via link',
            responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('appointment_id', validation.appointment_id)
        .eq('status', 'sent');

    return res.status(200).send(generateHTML(
        'Consulta Cancelada',
        '❌',
        'Sua consulta foi cancelada. Se precisar reagendar, entre em contato conosco.',
        '#ef4444'
    ));
}

async function handleReschedule(validation: any, token: string, res: VercelResponse) {
    // Mark token as used
    await supabaseAdmin.rpc('mark_token_used', { p_token: token });

    // Update workflow status
    await supabaseAdmin
        .from('whatsapp_workflows')
        .update({
            status: 'completed',
            response: 'reschedule requested via link',
            responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('appointment_id', validation.appointment_id)
        .eq('status', 'sent');

    return res.status(200).send(generateHTML(
        'Pedido de Reagendamento',
        '📅',
        'Recebemos o seu pedido de reagendamento. Nossa equipa entrará em contacto em breve para remarcar a sua consulta.',
        '#3b82f6'
    ));
}

function generateHTML(title: string, icon: string, message: string, color: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
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
            color: ${color};
            margin-bottom: 10px;
            font-size: 28px;
          }
          p {
            color: #6b7280;
            font-size: 16px;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">${icon}</div>
          <h1>${title}</h1>
          <p>${message}</p>
          <p style="margin-top: 20px; font-size: 14px; color: #9ca3af;">Você pode fechar esta janela.</p>
        </div>
      </body>
      </html>
    `;
}
