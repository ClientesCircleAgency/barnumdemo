import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../../src/integrations/supabase/types';

type InviteUserRequest = {
    email?: string;
    role?: 'doctor' | 'secretary';
};

type InviteUserResponse = {
    success: boolean;
    error?: string;
    user?: {
        id: string;
        email: string | null;
        role: 'doctor' | 'secretary';
    };
};

export default async function handler(
    req: VercelRequest,
    res: VercelResponse<InviteUserResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Missing authorization'
            });
        }

        const jwt = authHeader.slice('Bearer '.length);
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            return res.status(500).json({
                success: false,
                error: 'Supabase environment variables not configured'
            });
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
        if (authError || !authData?.user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
            _user_id: authData.user.id,
            _role: 'admin'
        });

        if (roleError) {
            return res.status(500).json({
                success: false,
                error: 'Failed to verify role'
            });
        }

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden'
            });
        }

        const { email, role } = (req.body || {}) as InviteUserRequest;

        if (!email || typeof email !== 'string' || !role || !['doctor', 'secretary'].includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email or role'
            });
        }

        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin
            .inviteUserByEmail(email);

        if (inviteError || !inviteData?.user) {
            return res.status(400).json({
                success: false,
                error: inviteError?.message || 'Failed to invite user'
            });
        }

        const invitedUserId = inviteData.user.id;

        const { error: roleInsertError } = await supabaseAdmin
            .from('user_roles')
            .insert({
                user_id: invitedUserId,
                role
            });

        if (roleInsertError) {
            await supabaseAdmin.auth.admin.deleteUser(invitedUserId);
            return res.status(500).json({
                success: false,
                error: 'Failed to assign role'
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                id: invitedUserId,
                email: inviteData.user.email,
                role
            }
        });
    } catch (error) {
        console.error('Invite user error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}
