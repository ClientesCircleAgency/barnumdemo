/**
 * Shared types for API endpoints
 */

export interface WebhookResponse {
    success: boolean;
    message?: string;
    data?: any;
    error?: string;
}

export interface ActionLinkResponse {
    success: boolean;
    message: string;
    redirectUrl?: string;
}

export interface TokenValidation {
    valid: boolean;
    appointmentId?: string;
    patientId?: string;
    actionType?: string;
    metadata?: any;
    errorMessage?: string;
}
