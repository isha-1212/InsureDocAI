export interface Document {
    id: string;
    type: 'Hospital Bill' | 'Pharmacy Bill' | 'Aadhaar Card' | 'PAN Card';
    status: 'Uploaded' | 'Missing';
    confidenceScore: number;
    imageUrl?: string;
}

export interface ExtractedField {
    fieldName: string;
    extractedValue: string;
    confidence: number;
}

export interface ValidationItem {
    label: string;
    status: 'match' | 'partial' | 'mismatch';
    details?: string;
}

export interface ClaimData {
    id: string;
    userName: string;
    policyNumber: string;
    claimAmount: number;
    status: 'Pending' | 'Approved' | 'Rejected';
    overallConfidence: number;
    riskLevel: 'Low' | 'Medium' | 'High';
    documents: Document[];
    extractedFields: ExtractedField[];
    crossDocumentValidation: ValidationItem[];
}