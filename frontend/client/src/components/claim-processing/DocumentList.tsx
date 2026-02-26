import { Document } from '@/types/claim-processing';
import { ConfidenceBadge } from './ConfidenceBadge';
import { cn } from '@/lib/utils';
import { FileText, FileImage, CreditCard, User, AlertCircle, CheckCircle } from 'lucide-react';

interface DocumentListProps {
    documents: Document[];
    selectedDocId?: string;
    onDocumentSelect: (docId: string) => void;
}

const getDocumentIcon = (type: Document['type']) => {
    switch (type) {
        case 'Hospital Bill': return <FileText className="w-4 h-4" />;
        case 'Pharmacy Bill': return <FileText className="w-4 h-4" />;
        case 'Aadhaar Card': return <User className="w-4 h-4" />;
        case 'PAN Card': return <CreditCard className="w-4 h-4" />;
        default: return <FileImage className="w-4 h-4" />;
    }
};

const getStatusIcon = (status: Document['status']) => {
    return status === 'Uploaded'
        ? <CheckCircle className="w-4 h-4 text-emerald-500" />
        : <AlertCircle className="w-4 h-4 text-red-500" />;
};

export function DocumentList({ documents, selectedDocId, onDocumentSelect }: DocumentListProps) {
    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b bg-slate-50">
                <h2 className="font-semibold text-slate-900">Documents</h2>
                <p className="text-sm text-slate-600">Click to view document</p>
            </div>

            <div className="flex-1 overflow-y-auto">
                {documents.map((doc) => (
                    <div
                        key={doc.id}
                        onClick={() => doc.status === 'Uploaded' && onDocumentSelect(doc.id)}
                        className={cn(
                            'p-4 border-b cursor-pointer transition-all duration-200',
                            doc.status === 'Missing' && 'cursor-not-allowed opacity-60',
                            selectedDocId === doc.id && 'bg-blue-50 border-blue-200',
                            selectedDocId !== doc.id && 'hover:bg-slate-50'
                        )}
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                                {getDocumentIcon(doc.type)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-medium text-sm text-slate-900 truncate">
                                        {doc.type}
                                    </h3>
                                    {getStatusIcon(doc.status)}
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className={cn(
                                        'text-xs px-2 py-1 rounded-full font-medium',
                                        doc.status === 'Uploaded'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-red-100 text-red-700'
                                    )}>
                                        {doc.status}
                                    </span>

                                    {doc.status === 'Uploaded' && (
                                        <ConfidenceBadge
                                            confidence={doc.confidenceScore}
                                            size="sm"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 bg-slate-50 border-t">
                <div className="text-xs text-slate-600">
                    {documents.filter(d => d.status === 'Uploaded').length} of {documents.length} uploaded
                </div>
            </div>
        </div>
    );
}