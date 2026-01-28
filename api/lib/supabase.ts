/**
 * Supabase client for Vercel serverless functions
 * Uses service role key for admin operations
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/integrations/supabase/types';

if (!process.env.VITE_SUPABASE_URL) {
    throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

export const supabaseAdmin = createClient<Database>(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);
