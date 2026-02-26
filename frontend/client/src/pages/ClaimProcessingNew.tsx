import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocation } from 'wouter';
import {
    FileText,
    CreditCard,
    CheckCircle,
    AlertTriangle,
    XCircle,
    ArrowLeft,
    User,
    Calendar,
    IndianRupee,
    Shield,
    Building,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    Eye
} from 'lucide-react';

// Mock claim data that would be fetched based on claim ID
const mockClaimData = {
    id: "CLM-2024-001234",
    userName: "Rajesh Kumar",
    policyNumber: "POL-INS-789456",
    claimAmount: 25000,
    status: "Pending Review",
    riskLevel: "Low",
    submissionDate: "2024-01-15",
    documents: [
        {
            id: "doc1",
            name: "Hospital Bill",
            type: "hospital_bill",
            status: "verified",
            icon: Building,
            preview: "/api/placeholder/600/800"
        },
        {
            id: "doc2",
            name: "Pharmacy Bill",
            type: "pharmacy_bill",
            status: "verified",
            icon: FileText,
            preview: "/api/placeholder/600/800"
        },
        {
            id: "doc3",
            name: "Aadhaar Card",
            type: "aadhaar",
            status: "verified",
            icon: CreditCard,
            preview: "/api/placeholder/600/400"
        },
        {
            id: "doc4",
            name: "PAN Card",
            type: "pan_card",
            status: "verified",
            icon: CreditCard,
            preview: "/api/placeholder/600/400"
        }
    ]
};

// Mock extracted fields for different document types
const mockExtractionData: { [key: string]: any[] } = {
    hospital_bill: [
        { field: "Patient Name", value: "Rajesh Kumar", confidence: 97 },
        { field: "Hospital Name", value: "Apollo Hospital", confidence: 95 },
        { field: "Treatment Date", value: "2024-01-10", confidence: 98 },
        { field: "Total Amount", value: "₹18,500", confidence: 96 },
        { field: "Doctor Name", value: "Dr. A. Sharma", confidence: 92 },
        { field: "Diagnosis", value: "Cardiac Checkup", confidence: 89 }
    ],
    pharmacy_bill: [
        { field: "Patient Name", value: "Rajesh Kumar", confidence: 96 },
        { field: "Pharmacy Name", value: "MedPlus", confidence: 94 },
        { field: "Date", value: "2024-01-12", confidence: 97 },
        { field: "Total Amount", value: "₹6,500", confidence: 98 },
        { field: "Prescription ID", value: "RX123456", confidence: 91 }
    ],
    aadhaar: [
        { field: "Name", value: "Rajesh Kumar", confidence: 99 },
        { field: "Aadhaar Number", value: "XXXX-XXXX-8742", confidence: 98 },
        { field: "Date of Birth", value: "15/08/1985", confidence: 97 },
        { field: "Address", value: "123 MG Road, Bangalore", confidence: 95 }
    ],
    pan_card: [
        { field: "Name", value: "Rajesh Kumar", confidence: 98 },
        { field: "PAN Number", value: "ABCPK1234M", confidence: 97 },
        { field: "Father's Name", value: "Suresh Kumar", confidence: 96 },
        { field: "Date of Birth", value: "15/08/1985", confidence: 95 }
    ]
};

// Mock cross-document comparison data
const mockCrossDocumentComparison = {
    "Patient Name": [
        { document: "Hospital Bill", value: "Rajesh Kumar", confidence: 97 },
        { document: "Pharmacy Bill", value: "Rajesh Kumar", confidence: 96 },
        { document: "Aadhaar Card", value: "Rajesh Kumar", confidence: 99 },
        { document: "PAN Card", value: "Rajesh Kumar", confidence: 98 }
    ],
    "Date of Birth": [
        { document: "Aadhaar Card", value: "15/08/1985", confidence: 97 },
        { document: "PAN Card", value: "15/08/1985", confidence: 95 }
    ],
    "Total Amount": [
        { document: "Hospital Bill", value: "₹18,500", confidence: 96 },
        { document: "Pharmacy Bill", value: "₹6,500", confidence: 98 }
    ]
};
// Mock validation results for cross-document validation
const mockValidationResults = [
    {
        status: 'pass',
        rule: 'Name Consistency',
        description: 'Patient name matches across all documents'
    },
    {
        status: 'pass',
        rule: 'Date of Birth Consistency',
        description: 'DOB matches between Aadhaar and PAN card'
    },
    {
        status: 'warning',
        rule: 'Total Amount Check',
        description: 'Combined amount (₹25,000) equals claim amount'
    }
];
const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return "text-emerald-600";
    if (confidence >= 85) return "text-amber-600";
    return "text-red-600";
};

export default function ClaimReviewPage() {
    const [selectedDocument, setSelectedDocument] = useState(mockClaimData.documents[0]);
    const [isDocumentListCollapsed, setIsDocumentListCollapsed] = useState(false);
    const [documentZoom, setDocumentZoom] = useState(100);
    const [_, setLocation] = useLocation();

    const handleApprove = () => {
        console.log('Claim approved');
        // In real app: API call to approve claim
        alert('Claim approved successfully!');
    };

    const handleReject = () => {
        console.log('Claim rejected');
        // In real app: Show rejection reason modal
        const reason = prompt('Please provide rejection reason:');
        if (reason) {
            console.log('Rejection reason:', reason);
            alert('Claim rejected.');
        }
    };

    const handleRequestReupload = () => {
        console.log('Re-upload requested');
        // In real app: Send re-upload request to user
        alert('Re-upload request sent to user.');
    };

    const selectedExtractionData = mockExtractionData[selectedDocument.type] || [];

    return (
        <Layout>
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation('/admin/claims')}
                        className="hover:bg-slate-100"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Claims List
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl font-bold text-slate-900">
                                    Claim Review - {mockClaimData.id}
                                </CardTitle>
                                <p className="text-slate-600">AI-assisted document verification and claim review</p>
                            </div>
                            <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-200 px-3 py-1"
                            >
                                {mockClaimData.status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <User className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-slate-600">Patient Name</p>
                                    <p className="font-semibold text-slate-900">{mockClaimData.userName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <IndianRupee className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-slate-600">Claim Amount</p>
                                    <p className="font-bold text-lg text-slate-900">₹{mockClaimData.claimAmount.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <Shield className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-slate-600">Policy Number</p>
                                    <p className="font-mono font-semibold text-slate-900">{mockClaimData.policyNumber}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <Calendar className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-slate-600">Submission Date</p>
                                    <p className="font-semibold text-slate-900">{mockClaimData.submissionDate}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content - Three Column Layout */}
            <div className="grid grid-cols-12 gap-6" style={{ height: 'calc(100vh - 320px)' }}>
                {/* LEFT COLUMN - Document List */}
                <div className="col-span-3">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold">Documents</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="space-y-1">
                                {mockClaimData.documents.map((doc) => {
                                    const Icon = doc.icon;
                                    const isSelected = selectedDocument.id === doc.id;

                                    return (
                                        <button
                                            key={doc.id}
                                            onClick={() => setSelectedDocument(doc)}
                                            className={`w-full p-4 text-left hover:bg-slate-50 border-l-4 transition-colors ${isSelected
                                                ? 'bg-blue-50 border-blue-500 border-l-4'
                                                : 'border-transparent hover:border-slate-200'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100' : 'bg-slate-100'
                                                    }`}>
                                                    <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-600'
                                                        }`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-medium text-sm ${isSelected ? 'text-blue-900' : 'text-slate-900'
                                                        }`}>
                                                        {doc.name}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                                                        <span className="text-xs text-emerald-600 font-medium">
                                                            Verified
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* CENTER COLUMN - Document Viewer */}
                <div className="col-span-6">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold">
                                {selectedDocument.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-full p-0">
                            <div className="h-full bg-slate-100 rounded-lg flex items-center justify-center border">
                                {/* Document Preview Placeholder */}
                                <div className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full mx-4">
                                    <div className="text-center mb-6">
                                        <div className="text-2xl font-bold mb-2">
                                            {selectedDocument.type === 'hospital_bill' && 'Apollo Hospital'}
                                            {selectedDocument.type === 'pharmacy_bill' && 'MedPlus Pharmacy'}
                                            {selectedDocument.type === 'aadhaar' && 'Aadhaar Card'}
                                            {selectedDocument.type === 'pan_card' && 'PAN Card'}
                                        </div>
                                        <div className="text-sm text-slate-600 mb-4">
                                            {selectedDocument.type === 'hospital_bill' && 'Medical Bill - Invoice #INV-2024-001'}
                                            {selectedDocument.type === 'pharmacy_bill' && 'Pharmacy Receipt - #RX123456'}
                                            {selectedDocument.type === 'aadhaar' && 'Government of India'}
                                            {selectedDocument.type === 'pan_card' && 'Income Tax Department'}
                                        </div>
                                    </div>

                                    {selectedDocument.type === 'hospital_bill' && (
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between border-b pb-2">
                                                <span>Patient Name:</span>
                                                <span className="font-semibold">Rajesh Kumar</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-2">
                                                <span>Consultation:</span>
                                                <span>₹12,000</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-2">
                                                <span>Diagnostic Tests:</span>
                                                <span>₹6,500</span>
                                            </div>
                                            <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                                <span>Total:</span>
                                                <span>₹18,500</span>
                                            </div>
                                        </div>
                                    )}

                                    {selectedDocument.type === 'pharmacy_bill' && (
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between border-b pb-2">
                                                <span>Patient Name:</span>
                                                <span className="font-semibold">Rajesh Kumar</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-2">
                                                <span>Medicine A:</span>
                                                <span>₹3,500</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-2">
                                                <span>Medicine B:</span>
                                                <span>₹3,000</span>
                                            </div>
                                            <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                                <span>Total:</span>
                                                <span>₹6,500</span>
                                            </div>
                                        </div>
                                    )}

                                    {selectedDocument.type === 'aadhaar' && (
                                        <div className="space-y-3 text-sm">
                                            <div className="text-center mb-4">
                                                <div className="w-16 h-20 bg-slate-200 rounded mx-auto mb-2"></div>
                                            </div>
                                            <div className="space-y-2">
                                                <div><span className="font-semibold">Name:</span> Rajesh Kumar</div>
                                                <div><span className="font-semibold">DOB:</span> 15/08/1985</div>
                                                <div><span className="font-semibold">Aadhaar:</span> XXXX-XXXX-8742</div>
                                                <div><span className="font-semibold">Address:</span> 123 MG Road, Bangalore</div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedDocument.type === 'pan_card' && (
                                        <div className="space-y-3 text-sm">
                                            <div className="space-y-2">
                                                <div><span className="font-semibold">Name:</span> Rajesh Kumar</div>
                                                <div><span className="font-semibold">Father's Name:</span> Suresh Kumar</div>
                                                <div><span className="font-semibold">DOB:</span> 15/08/1985</div>
                                                <div><span className="font-semibold">PAN:</span> ABCPK1234M</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT COLUMN - ML Extraction & Admin Decision Panel */}
                <div className="col-span-3">
                    <div className="space-y-6 h-full">
                        {/* Extracted Fields */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold">Extracted Fields</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {selectedExtractionData.map((item, index) => (
                                        <div key={index} className="p-3 bg-slate-50 rounded-lg border">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-sm font-medium text-slate-700">
                                                    {item.field}
                                                </span>
                                                <span className={`text-xs font-bold ${getConfidenceColor(item.confidence)}`}>
                                                    {item.confidence}%
                                                </span>
                                            </div>
                                            <div className="text-sm font-semibold text-slate-900">
                                                {item.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Cross-Document Validation */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold">Cross-Document Validation</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {mockValidationResults.map((result, index) => (
                                        <div key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50">
                                            <div className="mt-0.5">
                                                {result.status === 'pass' && (
                                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                                )}
                                                {result.status === 'warning' && (
                                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                )}
                                                {result.status === 'fail' && (
                                                    <XCircle className="w-4 h-4 text-red-500" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900">
                                                    {result.rule}
                                                </p>
                                                <p className="text-xs text-slate-600 mt-1">
                                                    {result.description}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Admin Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold">Admin Actions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <Button
                                        onClick={handleApprove}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Approve Claim
                                    </Button>
                                    <Button
                                        onClick={handleReject}
                                        variant="outline"
                                        className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                                    >
                                        <XCircle className="w-4 h-4 mr-2" />
                                        Reject Claim
                                    </Button>
                                    <Button
                                        onClick={handleRequestReupload}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        <AlertTriangle className="w-4 h-4 mr-2" />
                                        Request Re-upload
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </Layout>
    );
}