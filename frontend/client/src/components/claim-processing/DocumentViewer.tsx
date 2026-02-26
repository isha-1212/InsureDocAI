import { Document } from '@/types/claim-processing';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCw, FileText } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DocumentViewerProps {
    document: Document | null;
}

export function DocumentViewer({ document }: DocumentViewerProps) {
    const [zoom, setZoom] = useState(100);
    const [rotation, setRotation] = useState(0);

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);

    if (!document || document.status === 'Missing') {
        return (
            <div className="h-full flex flex-col">
                <div className="p-4 border-b bg-white">
                    <h2 className="font-semibold text-slate-900">Document Viewer</h2>
                    <p className="text-sm text-slate-600">Select a document to view</p>
                </div>

                <div className="flex-1 flex items-center justify-center bg-slate-50">
                    <div className="text-center">
                        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No document selected</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-semibold text-slate-900">{document.type}</h2>
                        <p className="text-sm text-slate-600">Page 1 of 1</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleZoomOut}
                            disabled={zoom <= 50}
                        >
                            <ZoomOut className="w-4 h-4" />
                        </Button>

                        <span className="text-sm font-medium min-w-[60px] text-center">
                            {zoom}%
                        </span>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleZoomIn}
                            disabled={zoom >= 200}
                        >
                            <ZoomIn className="w-4 h-4" />
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRotate}
                        >
                            <RotateCw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Document Preview */}
            <div className="flex-1 bg-slate-100 p-6 overflow-hidden">
                <div className="h-full flex items-center justify-center">
                    <div
                        className="bg-white shadow-lg transition-all duration-300"
                        style={{
                            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                            transformOrigin: 'center',
                        }}
                    >
                        {/* Mock Document Content */}
                        <div className="w-[600px] h-[800px] p-8 relative overflow-hidden">
                            {document.type === 'Hospital Bill' && (
                                <MockHospitalBill />
                            )}
                            {document.type === 'Pharmacy Bill' && (
                                <MockPharmacyBill />
                            )}
                            {document.type === 'Aadhaar Card' && (
                                <MockAadhaarCard />
                            )}
                            {document.type === 'PAN Card' && (
                                <MockPANCard />
                            )}

                            {/* Verification Badge */}
                            <div className="absolute top-4 right-4">
                                <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                                    AI VERIFIED
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Mock Document Components
function MockHospitalBill() {
    return (
        <div className="space-y-4">
            <div className="text-center border-b pb-4">
                <h1 className="text-2xl font-bold text-blue-800">APOLLO HOSPITAL</h1>
                <p className="text-sm text-slate-600">Bannerghatta Road, Bangalore - 560076</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p><strong>Patient:</strong> Rajesh Kumar</p>
                    <p><strong>Age:</strong> 45 Years</p>
                    <p><strong>Gender:</strong> Male</p>
                </div>
                <div>
                    <p><strong>Bill No:</strong> APL-2024-5678</p>
                    <p><strong>Date:</strong> 15-01-2024</p>
                    <p><strong>Doctor:</strong> Dr. Sharma</p>
                </div>
            </div>

            <div className="mt-6">
                <h3 className="font-semibold mb-3">Treatment Details</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>Consultation Fee</span>
                        <span>₹1,500</span>
                    </div>
                    <div className="flex justify-between">
                        <span>ECG Test</span>
                        <span>₹800</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Blood Test</span>
                        <span>₹1,200</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Cardiac Assessment</span>
                        <span>₹15,000</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Room Charges (2 days)</span>
                        <span>₹6,500</span>
                    </div>
                    <div className="border-t pt-2 mt-4 flex justify-between font-bold">
                        <span>Total Amount</span>
                        <span>₹25,000</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MockPharmacyBill() {
    return (
        <div className="space-y-4">
            <div className="text-center border-b pb-4">
                <h1 className="text-xl font-bold text-green-700">MedPlus Pharmacy</h1>
                <p className="text-sm text-slate-600">Shop No. 45, MG Road, Bangalore</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p><strong>Customer:</strong> Rajesh Kumar</p>
                    <p><strong>Phone:</strong> +91 9876543210</p>
                </div>
                <div>
                    <p><strong>Bill No:</strong> MP-789456</p>
                    <p><strong>Date:</strong> 17-01-2024</p>
                </div>
            </div>

            <div className="mt-6">
                <h3 className="font-semibold mb-3">Prescribed Medicines</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>Cardace 2.5mg (30 tablets)</span>
                        <span>₹450</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Ecosprin 75mg (30 tablets)</span>
                        <span>₹85</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Atorvastatin 20mg (30 tablets)</span>
                        <span>₹320</span>
                    </div>
                    <div className="border-t pt-2 mt-4 flex justify-between font-bold">
                        <span>Total Amount</span>
                        <span>₹855</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MockAadhaarCard() {
    return (
        <div className="bg-gradient-to-br from-orange-50 to-green-50 h-full p-6 border-2 border-orange-200">
            <div className="text-center mb-6">
                <h1 className="text-xl font-bold text-orange-600">आधार</h1>
                <p className="text-sm text-slate-600">Aadhaar</p>
            </div>

            <div className="flex gap-6">
                <div className="w-24 h-32 bg-slate-200 rounded border flex items-center justify-center">
                    <span className="text-xs text-slate-500">Photo</span>
                </div>

                <div className="flex-1 space-y-3">
                    <div>
                        <p className="text-sm text-slate-600">Name:</p>
                        <p className="font-semibold">Rajesh Kumar</p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-600">DOB:</p>
                        <p className="font-semibold">15/08/1978</p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-600">Gender:</p>
                        <p className="font-semibold">Male</p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-600">Address:</p>
                        <p className="font-semibold text-xs leading-4">
                            123, MG Road, Koramangala,<br />
                            Bangalore, Karnataka - 560034
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t">
                <p className="text-lg font-mono tracking-wide text-center">
                    **** **** 7856
                </p>
            </div>
        </div>
    );
}

function MockPANCard() {
    return (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 h-full p-6 border-2 border-blue-200">
            <div className="text-center mb-6">
                <h1 className="text-lg font-bold text-blue-600">INCOME TAX DEPARTMENT</h1>
                <p className="text-sm text-slate-600">GOVT. OF INDIA</p>
                <p className="text-xs">Permanent Account Number Card</p>
            </div>

            <div className="flex gap-6">
                <div className="w-20 h-24 bg-slate-200 rounded border flex items-center justify-center">
                    <span className="text-xs text-slate-500">Photo</span>
                </div>

                <div className="flex-1 space-y-3">
                    <div>
                        <p className="text-sm text-slate-600">Name:</p>
                        <p className="font-semibold">RAJESH KUMAR</p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-600">Father's Name:</p>
                        <p className="font-semibold">MOHAN KUMAR</p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-600">Date of Birth:</p>
                        <p className="font-semibold">15/08/1978</p>
                    </div>

                    <div className="mt-4 pt-3 border-t">
                        <p className="text-xl font-mono font-bold tracking-widest text-center text-blue-800">
                            ABCDE1234F
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}