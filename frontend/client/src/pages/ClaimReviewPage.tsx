import { useState } from 'react';
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
        { field: "Total Amount", value: "₹18,500", confidence: 96 }
    ],
    pharmacy_bill: [
        { field: "Patient Name", value: "Rajesh Kumar", confidence: 96 },
        { field: "Pharmacy Name", value: "MedPlus", confidence: 94 },
        { field: "Date", value: "2024-01-12", confidence: 97 },
        { field: "Total Amount", value: "₹6,500", confidence: 98 }
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
        alert('Claim approved successfully!');
    };

    const handleReject = () => {
        console.log('Claim rejected');
        const reason = prompt('Please provide rejection reason:');
        if (reason) {
            console.log('Rejection reason:', reason);
            alert('Claim rejected.');
        }
    };

    const handleRequestReupload = () => {
        console.log('Re-upload requested');
        alert('Re-upload request sent to user.');
    };

    const selectedExtractionData = mockExtractionData[selectedDocument.type] || [];

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top Navigation Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation('/admin/claims')}
                            className="hover:bg-slate-100"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Claims List
                        </Button>
                        <div className="h-6 w-px bg-slate-300" />
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">
                                Claim Review - {mockClaimData.id}
                            </h1>
                            <p className="text-sm text-slate-600">
                                {mockClaimData.userName} • ₹{mockClaimData.claimAmount.toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200 px-3 py-1"
                    >
                        {mockClaimData.status}
                    </Badge>
                </div>
            </div>

            {/* Main Review Interface */}
            <div className="flex h-screen">
                {/* LEFT COLUMN - Document List (Collapsible) */}
                <div className={`bg-white border-r border-slate-200 transition-all duration-300 ${isDocumentListCollapsed ? 'w-16' : 'w-80'
                    }`}>
                    <div className="h-full flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            {!isDocumentListCollapsed && (
                                <h2 className="font-semibold text-slate-900">Documents</h2>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsDocumentListCollapsed(!isDocumentListCollapsed)}
                                className="ml-auto"
                            >
                                {isDocumentListCollapsed ? (
                                    <ChevronRight className="w-4 h-4" />
                                ) : (
                                    <ChevronLeft className="w-4 h-4" />
                                )}
                            </Button>
                        </div>

                        {/* Document List */}
                        <div className="flex-1 overflow-y-auto">
                            {mockClaimData.documents.map((doc) => {
                                const Icon = doc.icon;
                                const isSelected = selectedDocument.id === doc.id;

                                return (
                                    <button
                                        key={doc.id}
                                        onClick={() => setSelectedDocument(doc)}
                                        className={`w-full p-4 text-left hover:bg-slate-50 border-l-4 transition-colors ${isSelected
                                                ? 'bg-blue-50 border-blue-500'
                                                : 'border-transparent hover:border-slate-200'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100' : 'bg-slate-100'
                                                }`}>
                                                <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-600'
                                                    }`} />
                                            </div>
                                            {!isDocumentListCollapsed && (
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
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* CENTER COLUMN - Document Viewer */}
                <div className="flex-1 flex flex-col bg-slate-100">
                    {/* Viewer Header */}
                    <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Eye className="w-5 h-5 text-slate-600" />
                            <h3 className="font-semibold text-slate-900">{selectedDocument.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDocumentZoom(Math.max(50, documentZoom - 25))}
                                disabled={documentZoom <= 50}
                            >
                                <ZoomOut className="w-4 h-4" />
                            </Button>
                            <span className="text-sm font-medium text-slate-600 min-w-[4rem] text-center">
                                {documentZoom}%
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDocumentZoom(Math.min(200, documentZoom + 25))}
                                disabled={documentZoom >= 200}
                            >
                                <ZoomIn className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Document Viewer Area */}
                    <div className="flex-1 p-8 flex items-center justify-center overflow-auto">
                        <div
                            className="bg-white shadow-xl rounded-lg border max-w-full max-h-full"
                            style={{
                                transform: `scale(${documentZoom / 100})`,
                                transformOrigin: 'center',
                                width: 'fit-content',
                                height: 'fit-content'
                            }}
                        >
                            {/* Document Content */}
                            <div className="p-8 w-96">
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
                    </div>
                </div>

                {/* RIGHT COLUMN - ML Extraction & Admin Panel */}
                <div className="w-96 bg-white border-l border-slate-200 flex flex-col">
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-4 space-y-4">
                            {/* Context-Aware Extraction */}
                            <Card className="shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-semibold">
                                        Extracted from {selectedDocument.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="space-y-2">
                                        {selectedExtractionData.slice(0, 4).map((item, index) => (
                                            <div key={index} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-b-0">
                                                <span className="text-sm text-slate-600">{item.field}</span>
                                                <div className="text-right">
                                                    <div className="text-sm font-semibold text-slate-900">
                                                        {item.value}
                                                    </div>
                                                    <div className={`text-xs font-medium ${getConfidenceColor(item.confidence)}`}>
                                                        {item.confidence}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Cross-Document Comparison */}
                            <Card className="shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-semibold">Cross-Document Verification</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="space-y-4">
                                        {Object.entries(mockCrossDocumentComparison).map(([fieldName, documents]) => (
                                            <div key={fieldName} className="space-y-2">
                                                <h4 className="text-sm font-medium text-slate-700 border-b border-slate-200 pb-1">
                                                    {fieldName}
                                                </h4>
                                                <div className="space-y-1">
                                                    {documents.map((doc, index) => {
                                                        const allValuesMatch = documents.every(d => d.value === documents[0].value);

                                                        return (
                                                            <div key={index} className="flex items-center justify-between text-xs py-1">
                                                                <span className="text-slate-600 truncate max-w-[100px]">
                                                                    {doc.document}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`font-medium ${allValuesMatch ? 'text-emerald-700' : 'text-red-700'
                                                                        }`}>
                                                                        {doc.value}
                                                                    </span>
                                                                    <div className={`w-2 h-2 rounded-full ${allValuesMatch ? 'bg-emerald-500' : 'bg-red-500'
                                                                        }`} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Admin Actions - Fixed at bottom */}
                    <div className="p-4 border-t border-slate-200 bg-slate-50">
                        <div className="space-y-2">
                            <Button
                                onClick={handleApprove}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                size="sm"
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve Claim
                            </Button>
                            <Button
                                onClick={handleReject}
                                variant="outline"
                                className="w-full text-red-600 border-red-200 hover:bg-red-50"
                                size="sm"
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject Claim
                            </Button>
                            <Button
                                onClick={handleRequestReupload}
                                variant="outline"
                                className="w-full"
                                size="sm"
                            >
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                Request Re-upload
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}