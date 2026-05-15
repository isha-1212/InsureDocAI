import { z } from 'zod';
export { insertPolicySchema } from '@/lib/policy-validation';

export interface InsertPolicy {
    policy_number: string;
    start_date: string;
    end_date: string;
    policy_document_url?: string;
}

export interface Policy extends InsertPolicy {
    id: number;
    user_id: number;
    status: 'pending' | 'under_review' | 'approved' | 'rejected';
    workflow_label?: string;
    is_editable?: boolean;
    rejection_reason?: string;
    total_coverage_amount?: number | string;
    used_coverage_amount?: number | string;
    remaining_coverage_amount?: number | string;
    timeline?: Array<{
        eventType: string;
        label: string;
        timestamp?: string;
        metadata?: Record<string, unknown>;
    }>;
    created_at: string;
    updated_at: string;
}

export interface InsertFamilyMember {
    policy: number;
    name: string;
    dob?: string;
    relation: 'self' | 'spouse' | 'child' | 'parent' | 'father' | 'mother' | 'son' | 'daughter';
}

export interface FamilyMember extends InsertFamilyMember {
    id: number;
    is_minor: boolean;
    age?: number;
    created_at: string;
}

export interface CreateClaimRequest {
    [key: string]: any;
}

export const insertFamilyMemberSchema = z.object({
    policy: z.number(),
    name: z.string().min(1, "Name is required"),
    dob: z.string().optional(),
    relation: z.enum(['self', 'spouse', 'child', 'parent', 'father', 'mother', 'son', 'daughter']),
});

export const insertClaimSchema = {} as any;
export const insertClaimDocumentSchema = {} as any;
