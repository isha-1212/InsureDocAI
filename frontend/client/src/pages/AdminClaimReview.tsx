/**
 * Admin Claim Review Component
 * Allows admin to review claims and view ML extracted data from all documents
 */

import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import {
    fetchClaimDocumentsForReview,
    triggerDocumentExtraction,
    reviewDocumentForClaim,
    processClaimDocuments,
    downloadAndCreateBlobUrl,
    getDocumentTypeName,
    type ClaimDocuments,
    type DocumentInfo
} from '../lib/documentBuckets';

interface ProcessedDocument extends DocumentInfo {
    blobUrl: string;
}

interface MLExtractionField {
    field_name: string;
    value: string;
    confidence: number;
}

const getFriendlyExtractionMessage = (rawMessage: string) => {
    const text = (rawMessage || '').toLowerCase();
    if (
        text.includes('all connection attempts failed') ||
        text.includes('connection refused') ||
        text.includes('unable to reach ml server') ||
        text.includes('connecterror')
    ) {
        return 'ML server is unreachable. The backend will try local fallback extraction if available.';
    }
    return rawMessage;
};

const getConfidenceTextClass = (confidence: number) => {
    if (confidence >= 0.8) return "text-emerald-400";
    if (confidence >= 0.5) return "text-blue-400";
    return "text-red-400";
};

// Animation variants - bounce from bottom
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.12,
            delayChildren: 0.15
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 100,
            damping: 12,
            bounce: 0.4
        }
    }
};

const AdminClaimReview: React.FC = () => {
    const [, params] = useRoute("/admin/claims/review/:claimId");
    const [, setLocation] = useLocation();

    const claimId = params?.claimId;

    const [claimData, setClaimData] = useState<ClaimDocuments | null>(null);
    const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
    const [mlExtractionData, setMlExtractionData] = useState<any>(null);
    const [extractionByDocId, setExtractionByDocId] = useState<Record<string, MLExtractionField[]>>({});
    const [extractionOrder, setExtractionOrder] = useState<string[]>([]);
    const [extractingDocId, setExtractingDocId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<ProcessedDocument | null>(null);
    const [docLoadingId, setDocLoadingId] = useState<string | null>(null);
    const [reviewRemarks, setReviewRemarks] = useState<string>("");
    const [reviewSaving, setReviewSaving] = useState(false);
    const [showRejectRemarks, setShowRejectRemarks] = useState(false);
    const isNoOcrDocument = (documentType?: string) => documentType === 'birth_certificate';

    useEffect(() => {
        if (!claimId) {
            setError('No claim ID provided');
            setLoading(false);
            return;
        }

        loadClaimDocuments();
    }, [claimId]);

    const loadClaimDocuments = async () => {
        try {
            setLoading(true);
            setError(null);

            // Get current session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error('Not authenticated');
            }

            // Fetch claim documents and preview metadata
            console.log(`Fetching documents for claim ${claimId}...`);
            const claimDocuments = await fetchClaimDocumentsForReview(claimId!, session.access_token);

            setClaimData(claimDocuments);

            // Process documents to create blob URLs
            console.log('Processing documents...');
            const { documents } = await processClaimDocuments(
                claimDocuments,
                session.access_token
            );

            setProcessedDocuments(documents);
            // Do not preload any extraction on page open.
            setMlExtractionData(null);
            setExtractionByDocId({});
            setExtractionOrder([]);

            // Select first document by default
            if (documents.length > 0) {
                setSelectedDocument(documents[0]);
            }

        } catch (err) {
            console.error('Error loading claim documents:', err);
            setError(err instanceof Error ? err.message : 'Failed to load claim documents');
        } finally {
            setLoading(false);
        }
    };

    const renderDocumentPreview = (doc: ProcessedDocument) => {
        if (!doc.blobUrl) {
            return (
                <div className="flex items-center justify-center p-6">
                    <p className="text-slate-400">
                        {docLoadingId === doc.document_id ? 'Loading document...' : 'Document preview not available'}
                    </p>
                </div>
            );
        }

        return (
            <img
                src={doc.blobUrl}
                alt={doc.original_filename}
                className="w-full h-auto object-contain rounded-lg"
            />
        );
    };

    const renderMLExtractionResults = (documentType: string, extractionData?: MLExtractionField[]) => {
        if (isNoOcrDocument(documentType)) {
            return null;
        }

        if (Array.isArray(extractionData) && extractionData.length === 0) {
            return null;
        }

        if (!extractionData) {
            return (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                    <p className="text-slate-300">No extraction data for {getDocumentTypeName(documentType)}</p>
                </div>
            );
        }

        return (
            <div className="w-full bg-gradient-to-br from-blue-900/30 to-cyan-900/20 border border-blue-800/50 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-blue-300 mb-3">
                    ML Extraction Results - {getDocumentTypeName(documentType)}
                </h4>
                <div className="space-y-2">
                    {Array.isArray(extractionData) ? (
                        extractionData.map((field: MLExtractionField, index) => (
                            <div key={index} className="flex justify-between items-center py-2 border-b border-blue-800/30 last:border-b-0">
                                <span className="font-medium text-blue-300">{field.field_name}:</span>
                                <div className="text-right">
                                    <div className="text-slate-200">
                                        {field.field_name === 'extraction_error'
                                            ? getFriendlyExtractionMessage(field.value)
                                            : field.value}
                                    </div>
                                    <div className={`text-sm font-medium ${getConfidenceTextClass(field.confidence)}`}>
                                        Confidence: {(field.confidence * 100).toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-slate-200">{JSON.stringify(extractionData, null, 2)}</div>
                    )}
                </div>
            </div>
        );
    };

    const renderErrorState = () => (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center">
            <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
                <div className="text-red-400 text-center">
                    <h2 className="text-xl font-semibold mb-2 text-white">Error</h2>
                    <p>{error}</p>
                    <button
                        onClick={() => setLocation('/admin/claims')}
                        className="mt-4 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-medium px-4 py-2 rounded-lg shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300"
                    >
                        Back to Admin Panel
                    </button>
                </div>
            </div>
        </div>
    );

    const renderLoadingState = () => (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center">
            <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl shadow-lg p-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
                    <p className="mt-4 text-slate-300">Loading claim documents and running ML extraction...</p>
                </div>
            </div>
        </div>
    );

    const handleSelectDocument = async (doc: ProcessedDocument) => {
        setSelectedDocument(doc);
        setReviewRemarks((doc as any).review_remarks || "");
        setShowRejectRemarks(false);
        if (!doc.blobUrl && doc.signed_url) {
            try {
                setDocLoadingId(doc.document_id);
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                if (!token) {
                    throw new Error('Not authenticated');
                }
                const blobUrl = await downloadAndCreateBlobUrl(doc.signed_url, token);
                setProcessedDocuments((prev) =>
                    prev.map((d) => d.document_id === doc.document_id ? { ...d, blobUrl } : d)
                );
                setSelectedDocument((prev) => prev && prev.document_id === doc.document_id ? { ...prev, blobUrl } : prev);
            } catch (err) {
                console.error('Error loading document preview:', err);
            } finally {
                setDocLoadingId(null);
            }
        }

        // Birth certificate: do not run extraction and do not show extraction UI.
        if (isNoOcrDocument(doc.document_type)) {
            setExtractingDocId(null);
            setExtractionByDocId((prev) => {
                const next = { ...prev };
                delete next[doc.document_id];
                return next;
            });
            setExtractionOrder((prev) => prev.filter((id) => id !== doc.document_id));
            return;
        }

        // Run ML only for clicked document.
        try {
            setExtractingDocId(doc.document_id);
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token || !claimId) {
                throw new Error('Not authenticated');
            }

            const result = await triggerDocumentExtraction(claimId, doc.document_id, token);
            const fields: MLExtractionField[] = Array.isArray(result?.fields) ? result.fields : [];

            setExtractionByDocId((prev) => ({
                ...prev,
                [doc.document_id]: fields
            }));
            setExtractionOrder((prev) => (prev.includes(doc.document_id) ? prev : [...prev, doc.document_id]));
            setMlExtractionData((prev: any) => ({
                ...(prev || {}),
                extraction_status: result?.extraction_status || 'completed',
            }));
        } catch (extractionErr) {
            console.error('Error triggering document extraction:', extractionErr);
            const errorField: MLExtractionField[] = [{
                field_name: 'extraction_error',
                value: extractionErr instanceof Error ? extractionErr.message : 'Extraction failed',
                confidence: 0.0
            }];
            setExtractionByDocId((prev) => ({
                ...prev,
                [doc.document_id]: errorField
            }));
            setExtractionOrder((prev) => (prev.includes(doc.document_id) ? prev : [...prev, doc.document_id]));
            setMlExtractionData((prev: any) => ({
                ...(prev || {}),
                extraction_status: 'error',
            }));
        } finally {
            setExtractingDocId(null);
        }
    };

    const handleDocumentReview = async (status: 'approved' | 'rejected', remarksOverride?: string) => {
        if (!claimId || !selectedDocument) return;
        try {
            const remarksToSend = status === 'rejected' ? String(remarksOverride ?? reviewRemarks ?? '').trim() : '';
            if (status === 'rejected' && !remarksToSend) {
                alert('Please add remarks before rejecting.');
                return;
            }
            setReviewSaving(true);
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Not authenticated');

            const result = await reviewDocumentForClaim(
                claimId,
                selectedDocument.document_id,
                status,
                remarksToSend,
                token
            );

            setProcessedDocuments((prev) =>
                prev.map((d) =>
                    d.document_id === selectedDocument.document_id
                        ? { ...d, review_status: result.review_status, review_remarks: result.review_remarks }
                        : d
                )
            );
            setSelectedDocument((prev) =>
                prev ? { ...prev, review_status: result.review_status, review_remarks: result.review_remarks } : prev
            );
            setClaimData((prev) => (prev ? { ...prev, claim_status: result.claim_status } : prev));
            setShowRejectRemarks(false);
        } catch (err) {
            console.error('Error reviewing document:', err);
            alert(err instanceof Error ? err.message : 'Failed to save review');
        } finally {
            setReviewSaving(false);
        }
    };

    if (loading) return renderLoadingState();
    if (error) return renderErrorState();
    if (!claimData) return renderErrorState();

    const visibleExtractionOrder = extractionOrder.filter((docId) => {
        const d = processedDocuments.find((x) => x.document_id === docId);
        return d && !isNoOcrDocument(d.document_type);
    });
    const shouldShowExtractionSections = !isNoOcrDocument(selectedDocument?.document_type);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">
            <div className="max-w-[1400px] mx-auto px-6 py-6">
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="w-full"
                >
                    {/* Header */}
                    <motion.div variants={itemVariants} className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl shadow-lg p-6 mb-6 w-full">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-white">Claim Review</h1>
                                <p className="text-slate-300 mt-1">
                                    Claim ID: <span className="text-blue-400">{claimData.claim_id}</span> | Status: <span className="text-blue-400">{claimData.claim_status}</span> |
                                    Amount: <span className="text-emerald-400">₹{claimData.total_amount || '0'}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setLocation('/admin/claims')}
                                className="bg-slate-700 hover:bg-slate-600 text-white font-medium px-4 py-2 rounded-lg transition-all duration-300 shadow-lg whitespace-nowrap"
                            >
                                Back to Admin
                            </button>
                        </div>
                    </motion.div>

                    {/* Main Grid Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
                        {/* LEFT COLUMN: Document List */}
                        <motion.div variants={itemVariants} className="lg:col-span-3 lg:sticky lg:top-6 flex flex-col space-y-4">
                            <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl shadow-lg p-6 w-full">
                                <h3 className="text-lg font-semibold text-white mb-4">Documents</h3>
                                <div className="space-y-3">
                                    {processedDocuments.map((doc) => (
                                        <button
                                            key={doc.document_id}
                                            onClick={() => handleSelectDocument(doc)}
                                            className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${selectedDocument?.document_id === doc.document_id
                                                ? 'border-blue-500 bg-gradient-to-br from-blue-900/40 to-cyan-900/30 shadow-lg shadow-blue-500/20'
                                                : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'
                                                }`}
                                        >
                                            <div className="font-medium text-slate-200">
                                                {getDocumentTypeName(doc.document_type)}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        {/* RIGHT COLUMN: Preview + Extraction + Status */}
                        <motion.div variants={itemVariants} className="lg:col-span-9 w-full flex flex-col space-y-6">
                            {selectedDocument && (
                                <>
                                    {/* Split Layout: Preview on Left, Extraction on Right */}
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                        {/* Document Preview */}
                                        <div className="w-full bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl shadow-lg p-6 flex flex-col h-[calc(100vh-200px)] max-h-[800px]">
                                            <h3 className="text-lg font-semibold text-white mb-4 flex-shrink-0">
                                                {getDocumentTypeName(selectedDocument.document_type)} Preview
                                            </h3>
                                            <div className="flex items-center justify-center w-full overflow-y-auto bg-slate-800/30 rounded-lg p-4 flex-1">
                                                {renderDocumentPreview(selectedDocument)}
                                            </div>
                                            <div className="mt-4 border-t border-slate-800/50 pt-4 flex-shrink-0">
                                                <div className="text-sm text-slate-300 mb-2">
                                                    Current Status: <strong className="text-blue-400">{(selectedDocument as any).review_status || 'pending'}</strong>
                                                </div>
                                                <div className="flex gap-3 mt-4">
                                                    <button
                                                        type="button"
                                                        className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-medium px-4 py-2 rounded-lg shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300 disabled:opacity-60"
                                                        disabled={reviewSaving}
                                                        onClick={() => handleDocumentReview('approved', '')}
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-medium px-4 py-2 rounded-lg shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 disabled:opacity-60"
                                                        disabled={reviewSaving}
                                                        onClick={() => setShowRejectRemarks(true)}
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                                {showRejectRemarks && (
                                                    <div className="mt-4 border-t border-slate-800/50 pt-4">
                                                        <textarea
                                                            className="w-full border border-slate-700 bg-slate-800/50 text-slate-200 placeholder:text-slate-500 rounded-lg p-3 text-sm focus:border-blue-500/50 focus:ring-blue-500/20 focus:outline-none focus:ring-2"
                                                            rows={3}
                                                            placeholder="Add rejection remarks..."
                                                            value={reviewRemarks}
                                                            onChange={(e) => setReviewRemarks(e.target.value)}
                                                        />
                                                        <div className="flex gap-3 mt-3">
                                                            <button
                                                                type="button"
                                                                className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-medium px-4 py-2 rounded-lg shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 disabled:opacity-60"
                                                                disabled={reviewSaving}
                                                                onClick={() => handleDocumentReview('rejected')}
                                                            >
                                                                Submit Reject
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="bg-slate-700 hover:bg-slate-600 text-white font-medium px-4 py-2 rounded-lg transition-all duration-300 disabled:opacity-60"
                                                                disabled={reviewSaving}
                                                                onClick={() => setShowRejectRemarks(false)}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* ML Extraction Results */}
                                        {shouldShowExtractionSections && (
                                            <div className="w-full bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl shadow-lg p-6 flex flex-col h-[calc(100vh-200px)] max-h-[800px]">
                                                <h3 className="text-lg font-semibold text-white mb-4 flex-shrink-0">ML Extraction Results</h3>
                                                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                                                    {extractingDocId && (
                                                        <div className="mb-4 text-sm text-blue-400">Running extraction for selected document...</div>
                                                    )}
                                                    {visibleExtractionOrder.length === 0 ? (
                                                        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                                                            <p className="text-slate-300">Select a document to run extraction</p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4 pr-2">
                                                            {visibleExtractionOrder.map((docId) => {
                                                                const extractedDoc = processedDocuments.find((d) => d.document_id === docId);
                                                                if (!extractedDoc) return null;
                                                                const content = renderMLExtractionResults(extractedDoc.document_type, extractionByDocId[docId]);
                                                                if (!content) return null;
                                                                return <div key={docId}>{content}</div>;
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </div>

                    {/* ML Extraction Summary */}
                    {shouldShowExtractionSections && visibleExtractionOrder.length > 0 && (
                        <motion.div variants={itemVariants} className="mt-6 bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl shadow-lg p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Overall Extraction Status</h3>
                            <div className="bg-slate-800/30 rounded-lg p-4">
                                <div className="text-slate-300">
                                    <p><strong className="text-white">Status:</strong> <span className="text-blue-400">{extractingDocId ? 'Processing...' : 'Ready'}</span></p>
                                    <p><strong className="text-white">Documents Processed:</strong> <span className="text-emerald-400">{visibleExtractionOrder.length}</span></p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default AdminClaimReview;
