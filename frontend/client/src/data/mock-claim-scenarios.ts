import { ClaimData } from '../types/claim-processing';

export const mockClaimDataScenarios: { [key: string]: ClaimData } = {
    'low-risk': {
        id: "CLM-2024-001234",
        userName: "Rajesh Kumar",
        policyNumber: "POL-INS-789456",
        claimAmount: 25000,
        status: "Pending",
        overallConfidence: 87,
        riskLevel: "Low",
        documents: [
            {
                id: "doc1",
                type: "Hospital Bill",
                status: "Uploaded",
                confidenceScore: 0.92,
            },
            {
                id: "doc2",
                type: "Pharmacy Bill",
                status: "Uploaded",
                confidenceScore: 0.89,
            },
            {
                id: "doc3",
                type: "Aadhaar Card",
                status: "Uploaded",
                confidenceScore: 0.95,
            },
            {
                id: "doc4",
                type: "PAN Card",
                status: "Uploaded",
                confidenceScore: 0.91,
            }
        ],
        extractedFields: [
            { fieldName: "Patient Name", extractedValue: "Rajesh Kumar", confidence: 0.97 },
            { fieldName: "Treatment Date", extractedValue: "2024-01-15", confidence: 0.94 },
            { fieldName: "Hospital Name", extractedValue: "Apollo Hospital", confidence: 0.91 },
            { fieldName: "Total Amount", extractedValue: "₹25,000", confidence: 0.96 },
            { fieldName: "Doctor Name", extractedValue: "Dr. Sharma", confidence: 0.88 },
            { fieldName: "Diagnosis", extractedValue: "Cardiac Check-up", confidence: 0.85 },
            { fieldName: "Patient Address", extractedValue: "123 MG Road, Bangalore", confidence: 0.92 },
            { fieldName: "Contact Number", extractedValue: "+91 9876543210", confidence: 0.89 }
        ],
        crossDocumentValidation: [
            {
                label: "Patient Name (Hospital vs Aadhaar)",
                status: "match",
                details: "Rajesh Kumar matches across documents"
            },
            {
                label: "Date within Policy Coverage",
                status: "match",
                details: "Treatment date 2024-01-15 is within active policy period"
            },
            {
                label: "Hospital vs Pharmacy Bills",
                status: "match",
                details: "Dates are consistent (same day prescription)"
            },
            {
                label: "Amount vs Policy Limit",
                status: "match",
                details: "₹25,000 is within ₹50,000 annual limit"
            },
            {
                label: "PAN Card Verification",
                status: "match",
                details: "All identity documents verified successfully"
            }
        ]
    },

    'high-risk': {
        id: "CLM-2024-004567",
        userName: "Priya Sharma",
        policyNumber: "POL-INS-234789",
        claimAmount: 85000,
        status: "Pending",
        overallConfidence: 45,
        riskLevel: "High",
        documents: [
            {
                id: "doc1",
                type: "Hospital Bill",
                status: "Uploaded",
                confidenceScore: 0.65,
            },
            {
                id: "doc2",
                type: "Pharmacy Bill",
                status: "Missing",
                confidenceScore: 0,
            },
            {
                id: "doc3",
                type: "Aadhaar Card",
                status: "Uploaded",
                confidenceScore: 0.72,
            },
            {
                id: "doc4",
                type: "PAN Card",
                status: "Missing",
                confidenceScore: 0,
            }
        ],
        extractedFields: [
            { fieldName: "Patient Name", extractedValue: "P. Sharma", confidence: 0.78 },
            { fieldName: "Treatment Date", extractedValue: "2024-01-20", confidence: 0.65 },
            { fieldName: "Hospital Name", extractedValue: "City Medical Center", confidence: 0.58 },
            { fieldName: "Total Amount", extractedValue: "₹85,000", confidence: 0.82 },
            { fieldName: "Doctor Name", extractedValue: "Dr. [Unclear]", confidence: 0.35 },
            { fieldName: "Diagnosis", extractedValue: "Emergency Surgery", confidence: 0.71 },
            { fieldName: "Patient Address", extractedValue: "[Partially visible]", confidence: 0.42 },
            { fieldName: "Contact Number", extractedValue: "+91 [Unclear]", confidence: 0.29 }
        ],
        crossDocumentValidation: [
            {
                label: "Patient Name (Hospital vs Aadhaar)",
                status: "partial",
                details: "Names don't match exactly - 'P. Sharma' vs 'Priya Sharma'"
            },
            {
                label: "Date within Policy Coverage",
                status: "match",
                details: "Treatment date is within policy period"
            },
            {
                label: "Hospital vs Pharmacy Bills",
                status: "mismatch",
                details: "Pharmacy bill not provided - unable to verify"
            },
            {
                label: "Amount vs Policy Limit",
                status: "partial",
                details: "₹85,000 approaches ₹100,000 annual limit"
            },
            {
                label: "PAN Card Verification",
                status: "mismatch",
                details: "PAN Card document not uploaded"
            }
        ]
    }
};

export const mockClaimData = mockClaimDataScenarios['low-risk'];