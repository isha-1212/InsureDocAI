import { ClaimData } from '../types/claim-processing';

export const mockClaimData: ClaimData = {
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
            imageUrl: "/api/placeholder/800/600"
        },
        {
            id: "doc2",
            type: "Pharmacy Bill",
            status: "Uploaded",
            confidenceScore: 0.89,
            imageUrl: "/api/placeholder/800/600"
        },
        {
            id: "doc3",
            type: "Aadhaar Card",
            status: "Uploaded",
            confidenceScore: 0.95,
            imageUrl: "/api/placeholder/800/600"
        },
        {
            id: "doc4",
            type: "PAN Card",
            status: "Missing",
            confidenceScore: 0,
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
            status: "partial",
            details: "Dates differ by 2 days - requires verification"
        },
        {
            label: "Amount vs Policy Limit",
            status: "match",
            details: "₹25,000 is within ₹50,000 annual limit"
        },
        {
            label: "PAN Card Verification",
            status: "mismatch",
            details: "PAN Card document not uploaded"
        }
    ]
};