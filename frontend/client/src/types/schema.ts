import { z } from 'zod';

export interface InsertPolicy {
    policy_number: string;
    start_date: string;
    end_date: string;
    policy_document_url?: string;
}

export interface Policy extends InsertPolicy {
    id: number;
    user_id: number;
    status: 'pending' | 'approved' | 'rejected';
    rejection_reason?: string;
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

export const insertPolicySchema = z.object({
    policy_number: z.string().min(1, "Policy number is required"),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    policy_document_url: z.string().optional(),
});

export const insertFamilyMemberSchema = z.object({
    policy: z.number(),
    name: z.string().min(1, "Name is required"),
    dob: z.string().optional(),
    relation: z.enum(['self', 'spouse', 'child', 'parent', 'father', 'mother', 'son', 'daughter']),
});

export const insertClaimSchema = {} as any;
export const insertClaimDocumentSchema = {} as any;
