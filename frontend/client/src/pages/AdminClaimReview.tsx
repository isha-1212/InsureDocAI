import React, { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    approveClaimForReview,
    fetchClaimValidationSummary,
    fetchClaimDocumentsForReview,
    reopenClaimForReview,
    triggerDocumentExtraction,
    rejectClaimForReview,
    reviewDocumentForClaim,
    downloadAndCreateBlobUrl,
    getDocumentTypeName,
    type ClaimDocuments,
    type ClaimValidationSummary,
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

type SectionKey =
    | 'reopened'
    | 'decision'
    | 'recommendation'
    | 'timeline'
    | 'fieldValidation'
    | 'documents'
    | 'extractionStatus';

const getFriendlyExtractionMessage = (rawMessage: string) => {
    const text = (rawMessage || '').toLowerCase();
    if (
        text.includes('all connection attempts failed') ||
        text.includes('connection refused') ||
        text.includes('unable to reach ml server') ||
        text.includes('connecterror')
    ) {
        return 'ML server is unreachable. Showing mock extraction - please verify manually.';
    }
    return rawMessage;
};

const getConfidenceTextClass = (confidence: number) => {
    if (confidence >= 0.8) return "text-emerald-400";
    if (confidence >= 0.5) return "text-amber-300";
    return "text-red-400";
};

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

const isNoOcrDocument = (documentType?: string) => documentType === 'birth_certificate';
const getDocumentBadgeClass = (documentStatus?: string) => {
    if (documentStatus === 'verified') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
    if (documentStatus === 'missing') return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
    return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
};

const getValidationMeta = (severity: string) => {
    if (severity === 'critical') {
        return {
            priority: 0,
            actionLabel: 'Fix Required',
            className: 'border-rose-500/20 bg-rose-500/5 text-rose-100',
            badgeClassName: 'bg-rose-500/10 text-rose-300',
            icon: ShieldAlert,
        };
    }
    if (severity === 'warning') {
        return {
            priority: 1,
            actionLabel: 'Check Needed',
            className: 'border-amber-500/20 bg-amber-500/5 text-amber-100',
            badgeClassName: 'bg-amber-500/10 text-amber-300',
            icon: AlertTriangle,
        };
    }
    return {
        priority: 2,
        actionLabel: 'Pass',
        className: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-100',
        badgeClassName: 'bg-emerald-500/10 text-emerald-300',
        icon: CheckCircle2,
    };
};

const getRecommendationMeta = (status?: string) => {
    if (status === 'do_not_approve') {
        return {
            label: 'Do Not Approve',
            description: 'Critical validation issues must be fixed before approval.',
            className: 'border-rose-500/20 bg-rose-500/5 text-rose-100',
            icon: ShieldAlert,
        };
    }
    if (status === 'manual_review') {
        return {
            label: 'Manual Review Required',
            description: 'Warnings still need manual verification before approval.',
            className: 'border-amber-500/20 bg-amber-500/5 text-amber-100',
            icon: AlertTriangle,
        };
    }
    return {
        label: 'Safe to Approve',
        description: 'All summary checks passed.',
        className: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-100',
        icon: CheckCircle2,
    };
};

const getConfidenceMeta = (level?: string, average?: number) => {
    if (!average || average <= 0 || level === 'Awaiting extraction') {
        return {
            label: 'Awaiting extraction',
            display: 'Overall Confidence: Awaiting extraction',
            className: 'border-blue-500/20 bg-blue-500/5 text-blue-100',
            valueClassName: 'text-blue-300',
        };
    }
    if (level === 'High') {
        return {
            label: 'High',
            display: `Overall Confidence: High (${average}%)`,
            className: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-100',
            valueClassName: 'text-emerald-300',
        };
    }
    if (level === 'Medium') {
        return {
            label: 'Medium',
            display: `Overall Confidence: Medium (${average}%)`,
            className: 'border-amber-500/20 bg-amber-500/5 text-amber-100',
            valueClassName: 'text-amber-300',
        };
    }
    return {
        label: 'Low',
        display: `Overall Confidence: Low (${average}%)`,
        className: 'border-rose-500/20 bg-rose-500/5 text-rose-100',
        valueClassName: 'text-rose-300',
    };
};

const dedupeTimelineEvents = (events: any[]) => {
    const uniqueEvents: any[] = [];
    let previousSignature = '';

    events.forEach((event) => {
        const signature = JSON.stringify({
            eventType: event?.eventType,
            label: event?.label,
            reason: event?.metadata?.reason || '',
            changesSummary: event?.metadata?.changesSummary || [],
        });

        if (signature === previousSignature && uniqueEvents.length > 0) {
            uniqueEvents[uniqueEvents.length - 1] = event;
            return;
        }

        uniqueEvents.push(event);
        previousSignature = signature;
    });

    return uniqueEvents;
};

const AdminClaimReview: React.FC = () => {
    const [, params] = useRoute("/admin/claims/review/:claimId");
    const [, setLocation] = useLocation();

    const claimId = params?.claimId;

    const [claimData, setClaimData] = useState<ClaimDocuments | null>(null);
    const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
    const [extractionByDocId, setExtractionByDocId] = useState<Record<string, MLExtractionField[]>>({});
    const [extractionOrder, setExtractionOrder] = useState<string[]>([]);
    const [extractingDocId, setExtractingDocId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<ProcessedDocument | null>(null);
    const [docLoadingId, setDocLoadingId] = useState<string | null>(null);
    const [claimRejectionRemarks, setClaimRejectionRemarks] = useState<string>("");
    const [documentRemarks, setDocumentRemarks] = useState<string>("");
    const [reviewSaving, setReviewSaving] = useState(false);
    const [showRejectRemarks, setShowRejectRemarks] = useState(false);
    const [documentActionLoading, setDocumentActionLoading] = useState(false);
    const [actionFeedback, setActionFeedback] = useState<string>("");
    const [validationSummary, setValidationSummary] = useState<ClaimValidationSummary | null>(null);
    const [validationLoading, setValidationLoading] = useState(false);
    const [activeValidationCheck, setActiveValidationCheck] = useState<string | null>(null);
    const [highlightedDocumentTypes, setHighlightedDocumentTypes] = useState<string[]>([]);
    const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
        reopened: false,
        decision: false,
        recommendation: false,
        timeline: false,
        fieldValidation: false,
        documents: false,
        extractionStatus: false,
    });

    const toggleSection = (key: SectionKey) => {
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

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

            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error('Not authenticated');
            }

            const claimDocuments = await fetchClaimDocumentsForReview(claimId!, session.access_token);
            setClaimData(claimDocuments);
            setClaimRejectionRemarks(claimDocuments.rejection_reason || "");

            const documents: ProcessedDocument[] = claimDocuments.documents.map((doc) => ({ ...doc, blobUrl: '' }));

            setProcessedDocuments(documents);
            setExtractionByDocId({});
            setExtractionOrder([]);
            setActiveValidationCheck(null);
            setHighlightedDocumentTypes([]);

            if (documents.length > 0) {
                setSelectedDocument(documents[0]);
                setDocumentRemarks((documents[0] as any).review_remarks || '');
                if (documents[0].signed_url) {
                    void (async () => {
                        try {
                            const blobUrl = await downloadAndCreateBlobUrl(documents[0].signed_url!, session.access_token);
                            setProcessedDocuments((prev) =>
                                prev.map((d) => d.document_id === documents[0].document_id ? { ...d, blobUrl } : d)
                            );
                            setSelectedDocument((prev) =>
                                prev && prev.document_id === documents[0].document_id ? { ...prev, blobUrl } : prev
                            );
                        } catch (previewError) {
                            console.error('Failed to preload first document preview:', previewError);
                        }
                    })();
                }
            } else {
                setSelectedDocument(null);
                setDocumentRemarks('');
            }

            // Finish initial load quickly; validation summary is non-blocking.
            setLoading(false);

            void (async () => {
                try {
                    setValidationLoading(true);
                    const summary = await fetchClaimValidationSummary(claimId!, session.access_token);
                    setValidationSummary(summary);
                } catch (validationError) {
                    console.error('Failed to load validation summary:', validationError);
                    setValidationSummary(null);
                } finally {
                    setValidationLoading(false);
                }
            })();

        } catch (err) {
            console.error('Error loading claim documents:', err);
            setError(err instanceof Error ? err.message : 'Failed to load claim documents');
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
                className="h-full w-auto max-w-full object-contain rounded-lg"
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
                    {extractionData.map((field: MLExtractionField, index) => (
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
                                {field.confidence < 0.8 && (
                                    <div className="text-xs text-amber-300 mt-1">
                                        Low confidence, verify manually
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
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
                    <p className="mt-4 text-slate-300">Loading claim documents...</p>
                </div>
            </div>
        </div>
    );

    const handleSelectDocument = async (doc: ProcessedDocument) => {
        let nextDoc = doc;
        setSelectedDocument(doc);
        setDocumentRemarks((doc as any).review_remarks || '');
        setShowRejectRemarks(false);
        setActionFeedback("");

        if (!doc.blobUrl && doc.signed_url) {
            try {
                setDocLoadingId(doc.document_id);
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                if (!token) throw new Error('Not authenticated');

                const blobUrl = await downloadAndCreateBlobUrl(doc.signed_url, token);
                nextDoc = { ...doc, blobUrl };
                setProcessedDocuments((prev) =>
                    prev.map((d) => d.document_id === doc.document_id ? nextDoc : d)
                );
                setSelectedDocument(nextDoc);
            } catch (err) {
                console.error('Error loading document preview:', err);
            } finally {
                setDocLoadingId(null);
            }
        }

        if (isNoOcrDocument(nextDoc.document_type)) {
            setExtractingDocId(null);
            return;
        }

        try {
            setExtractingDocId(nextDoc.document_id);
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token || !claimId) throw new Error('Not authenticated');

            const result = await triggerDocumentExtraction(claimId, nextDoc.document_id, token);
            const fields: MLExtractionField[] = Array.isArray(result?.fields) ? result.fields : [];

            setExtractionByDocId((prev) => ({
                ...prev,
                [nextDoc.document_id]: fields
            }));
            setExtractionOrder((prev) => (prev.includes(nextDoc.document_id) ? prev : [...prev, nextDoc.document_id]));
            try {
                setValidationLoading(true);
                const summary = await fetchClaimValidationSummary(claimId, token);
                setValidationSummary(summary);
            } catch (validationError) {
                console.error('Validation summary refresh failed:', validationError);
            } finally {
                setValidationLoading(false);
            }
        } catch (extractionErr) {
            console.error('Error triggering document extraction:', extractionErr);
            setExtractionByDocId((prev) => ({
                ...prev,
                [nextDoc.document_id]: [{
                    field_name: 'extraction_error',
                    value: extractionErr instanceof Error ? extractionErr.message : 'Extraction failed',
                    confidence: 0.0
                }]
            }));
            setExtractionOrder((prev) => (prev.includes(nextDoc.document_id) ? prev : [...prev, nextDoc.document_id]));
        } finally {
            setExtractingDocId(null);
        }
    };

    const handleApproveClaim = async () => {
        if (!claimId) return;
        try {
            setReviewSaving(true);
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Not authenticated');

            const result = await approveClaimForReview(claimId, token);
            setClaimData((prev) => prev ? {
                ...prev,
                claim_status: result.status,
                rejection_reason: null,
                updated_at: result.updated_at,
                coverage_summary: result.coverage_summary,
            } : prev);
            setClaimRejectionRemarks('');
            setShowRejectRemarks(false);
            setLocation('/admin/claims');
        } catch (err) {
            console.error('Error approving claim:', err);
            alert(err instanceof Error ? err.message : 'Failed to approve claim');
        } finally {
            setReviewSaving(false);
        }
    };

    const handleRejectClaim = async () => {
        if (!claimId) return;
        try {
            const remarksToSend = String(claimRejectionRemarks || '').trim();
            if (!remarksToSend) {
                alert('Please add rejection remarks before rejecting.');
                return;
            }

            setReviewSaving(true);
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Not authenticated');

            const result = await rejectClaimForReview(claimId, remarksToSend, token);
            setClaimData((prev) => prev ? {
                ...prev,
                claim_status: result.status,
                rejection_reason: result.rejection_reason,
                updated_at: result.updated_at
            } : prev);
            setClaimRejectionRemarks(result.rejection_reason || '');
            setShowRejectRemarks(false);
            setLocation('/admin/claims');
        } catch (err) {
            console.error('Error rejecting claim:', err);
            alert(err instanceof Error ? err.message : 'Failed to reject claim');
        } finally {
            setReviewSaving(false);
        }
    };

    const handleReopenClaim = async () => {
        if (!claimId) return;
        const reopenReason = window.prompt("Reason for reopening");
        if (!reopenReason || !reopenReason.trim()) return;

        try {
            setReviewSaving(true);
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Not authenticated');

            const result = await reopenClaimForReview(claimId, reopenReason.trim(), token);
            setClaimData((prev) => prev ? {
                ...prev,
                claim_status: result.status,
                is_reopened: result.is_reopened,
                reopen_reason: result.reopen_reason,
                reopened_at: result.reopened_at,
                updated_at: result.updated_at,
                coverage_summary: result.coverage_summary,
            } as any : prev);
            setActionFeedback('Claim reopened for correction');
            setShowRejectRemarks(false);
            try {
                setValidationLoading(true);
                const summary = await fetchClaimValidationSummary(claimId, token);
                setValidationSummary(summary);
            } catch (validationError) {
                console.error('Validation summary refresh failed after reopen:', validationError);
            } finally {
                setValidationLoading(false);
            }
            await loadClaimDocuments();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to reopen claim');
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
    const isApprovedClaim = String(claimData.claim_status || '').toLowerCase() === 'approved';
    const isPendingLikeClaim = ['pending', 'reapplied'].includes(String(claimData.claim_status || '').toLowerCase());
    const verifiedDocumentCount = processedDocuments.filter((doc) => String((doc as any).document_status || '').toLowerCase() === 'verified').length;
    const orderedValidationChecks = validationSummary
        ? [...validationSummary.checks].sort((a, b) => getValidationMeta(a.severity).priority - getValidationMeta(b.severity).priority)
        : [];
    const recommendationMeta = getRecommendationMeta(validationSummary?.recommendation?.status);
    const RecommendationIcon = recommendationMeta.icon;
    const recommendationReasons = Array.isArray(validationSummary?.recommendation?.reasons)
        ? validationSummary!.recommendation.reasons
        : [];
    const nextActionHint = validationSummary?.recommendation?.next_action || '';
    const confidenceMeta = getConfidenceMeta(validationSummary?.confidence_level, validationSummary?.average_field_confidence);
    const timelineEvents = dedupeTimelineEvents(Array.isArray(claimData.timeline) ? claimData.timeline : []);
    const isFinalizedClaim = ['approved', 'rejected'].includes(String(claimData.claim_status || '').toLowerCase());
    const reopenSummaryText = claimData.is_reopened && claimData.reopen_reason
        ? `Reason: ${claimData.reopen_reason}`
        : 'No reopen activity';

    const updateSelectedDocumentStatus = async (nextStatus: 'verified' | 'issue' | 'missing') => {
        if (!claimId || !selectedDocument || (selectedDocument as any).is_missing) return;
        try {
            setDocumentActionLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Not authenticated');

            const remarks = nextStatus === 'issue'
                ? (String(documentRemarks || '').trim() || 'Document has an issue')
                : nextStatus === 'missing'
                    ? (String(documentRemarks || '').trim() || 'Marked missing during review')
                    : '';

            const result = await reviewDocumentForClaim(
                claimId,
                selectedDocument.document_id,
                nextStatus,
                remarks,
                token
            );

            const nextDocumentStatus = String(result.document_status || nextStatus).toLowerCase();
            setProcessedDocuments((prev) =>
                prev.map((doc) =>
                    doc.document_id === selectedDocument.document_id
                        ? { ...doc, document_status: nextDocumentStatus, review_status: result.review_status, review_remarks: result.review_remarks } as any
                        : doc
                )
            );
            setSelectedDocument((prev) =>
                prev ? { ...prev, document_status: nextDocumentStatus, review_status: result.review_status, review_remarks: result.review_remarks } as any : prev
            );
            setDocumentRemarks(result.review_remarks || '');
            if (result?.claim_status) {
                setClaimData((prev) => prev ? {
                    ...prev,
                    claim_status: String(result.claim_status).toLowerCase(),
                } as any : prev);
            }
            setActionFeedback(
                nextDocumentStatus === 'verified'
                    ? 'Document marked as Verified'
                    : nextDocumentStatus === 'missing'
                        ? 'Document marked as Missing'
                        : 'Document marked as Issue'
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update document status';
            if (String(message).toLowerCase().includes('finalized claims must be reopened')) {
                try {
                    await loadClaimDocuments();
                } catch (refreshError) {
                    console.error('Failed to refresh claim after finalized-state error:', refreshError);
                }
            }
            alert(err instanceof Error ? err.message : 'Failed to update document status');
        } finally {
            setDocumentActionLoading(false);
        }
    };

    const handleValidationCheckClick = (check: ClaimValidationSummary['checks'][number]) => {
        setActiveValidationCheck(check.type);
        const relatedDocuments = Array.isArray(check.related_documents) ? check.related_documents : [];
        setHighlightedDocumentTypes(relatedDocuments);

        const relatedDocument = processedDocuments.find((doc) => relatedDocuments.includes(doc.document_type));
        if (relatedDocument && relatedDocument.document_id !== selectedDocument?.document_id) {
            void handleSelectDocument(relatedDocument);
        }
    };

    const coverageSummary = (claimData as any).coverage_summary;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="fixed inset-x-0 top-0 z-50 border-b border-slate-800/90 bg-slate-950/95 backdrop-blur"
            >
                <div className="max-w-[1500px] mx-auto px-6 py-3">
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.5fr_auto] gap-3 items-center">
                        <h1 className="text-xl font-bold text-white">Claim Review</h1>

                        <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center justify-center xl:justify-start gap-x-4 gap-y-1 text-sm">
                                <p className="text-slate-300">Claim ID: <span className="text-blue-400">{claimData.claim_id}</span></p>
                                <p className="text-slate-300">Status: <span className="text-blue-400">{claimData.claim_status}</span></p>
                                <p className="text-slate-300">Amount: <span className="text-emerald-400">Rs. {claimData.total_amount || '0'}</span></p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center xl:justify-start gap-1.5">
                                {claimData.is_reapplied && (
                                    <>
                                        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-300">Reapplied</span>
                                        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">Previously Rejected</span>
                                    </>
                                )}
                                {isApprovedClaim && (
                                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Approved</span>
                                )}
                                {claimData.is_reopened && (
                                    <>
                                        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-300">Reopened</span>
                                        <span className="rounded-full border border-blue-500/30 bg-blue-500/5 px-2 py-0.5 text-[11px] text-blue-200 max-w-[520px] truncate">{reopenSummaryText}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            {isFinalizedClaim && (
                                <button
                                    type="button"
                                    className="bg-blue-600/80 hover:bg-blue-600 text-white font-medium px-3 py-2 rounded-lg text-sm transition-all duration-300 disabled:opacity-60"
                                    disabled={reviewSaving}
                                    onClick={handleReopenClaim}
                                >
                                    Reopen Claim
                                </button>
                            )}
                            <button
                                onClick={() => setLocation('/admin/claims')}
                                className="bg-slate-700 hover:bg-slate-600 text-white font-medium px-3 py-2 rounded-lg text-sm transition-all duration-300 shadow-lg whitespace-nowrap"
                            >
                                Back to Admin
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="max-w-[1500px] mx-auto px-6 pt-28 pb-8">
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="w-full space-y-6"
                >
                    <div className="grid grid-cols-1 xl:grid-cols-[60%_40%] gap-6 items-start">
                        <motion.div variants={itemVariants} className="space-y-6">
                            <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('reopened')}
                                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-white">This Claim Was Reopened</p>
                                        {!openSections.reopened && claimData.is_reopened && claimData.reopen_reason && (
                                            <p className="text-xs text-blue-300 mt-1 truncate">{claimData.reopen_reason}</p>
                                        )}
                                    </div>
                                    {openSections.reopened ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                                </button>
                                {openSections.reopened && (
                                    <div className="px-4 pb-4 border-t border-slate-800/70">
                                        {claimData.is_reopened && claimData.reopen_reason ? (
                                            <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                                                <p className="text-sm text-blue-100">Reason: {claimData.reopen_reason}</p>
                                                {claimData.reopened_at && (
                                                    <p className="mt-1 text-xs text-slate-300">{new Date(claimData.reopened_at).toLocaleString()}</p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="mt-3 text-sm text-slate-400">No reopen activity recorded.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('decision')}
                                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                                >
                                    <p className="text-sm font-semibold text-white">Final Decision Summary + Coverage</p>
                                    {openSections.decision ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                                </button>
                                {openSections.decision && (
                                    <div className="px-4 pb-4 border-t border-slate-800/70">
                                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                                            <div>
                                                <p className="text-xs text-slate-500">Final Status</p>
                                                <p className={`text-sm font-semibold ${String(claimData.claim_status || '').toLowerCase() === 'approved' ? 'text-emerald-300' : String(claimData.claim_status || '').toLowerCase() === 'rejected' ? 'text-rose-300' : 'text-blue-300'}`}>
                                                    {claimData.claim_status || 'Pending'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Claim Amount</p>
                                                <p className="text-sm font-semibold text-white">Rs. {claimData.total_amount || '0'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Documents Verified</p>
                                                <p className="text-sm font-semibold text-white">{verifiedDocumentCount}</p>
                                            </div>
                                        </div>
                                        {claimData.rejection_reason && (
                                            <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">Previous Rejection Reason</p>
                                                <p className="mt-1 text-sm text-rose-200">{claimData.rejection_reason}</p>
                                            </div>
                                        )}
                                        {coverageSummary && (
                                            <div className={`mt-3 rounded-lg border px-4 py-3 ${coverageSummary.exceeds_remaining_coverage ? 'border-rose-500/20 bg-rose-500/5' : 'border-slate-700/80 bg-slate-900/50'}`}>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coverage Summary</p>
                                                <div className="mt-2 grid gap-2 md:grid-cols-4">
                                                    <div>
                                                        <p className="text-xs text-slate-500">Total Coverage</p>
                                                        <p className="text-sm font-semibold text-white">₹{coverageSummary.total_coverage_amount}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500">Used Coverage</p>
                                                        <p className="text-sm font-semibold text-white">₹{coverageSummary.used_coverage_amount}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500">Remaining Coverage</p>
                                                        <p className="text-sm font-semibold text-emerald-300">₹{coverageSummary.remaining_coverage_amount}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500">Requested Claim Amount</p>
                                                        <p className="text-sm font-semibold text-white">₹{coverageSummary.requested_claim_amount}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('recommendation')}
                                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-white">Final Recommendation + Reasons</p>
                                        {!openSections.recommendation && validationSummary && (
                                            <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200">
                                                {validationSummary.recommendation?.label || recommendationMeta.label}
                                            </span>
                                        )}
                                    </div>
                                    {openSections.recommendation ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                                </button>
                                {openSections.recommendation && validationSummary && (
                                    <div className="px-4 pb-4 border-t border-slate-800/70">
                                        <div className={`mt-3 rounded-xl border px-4 py-4 ${recommendationMeta.className}`}>
                                            <div className="flex items-start gap-3">
                                                <RecommendationIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-base font-semibold">{validationSummary.recommendation?.label || recommendationMeta.label}</p>
                                                    <p className="mt-1 text-sm opacity-90">{validationSummary.recommendation?.description || recommendationMeta.description}</p>
                                                    {recommendationReasons.length > 0 && (
                                                        <div className="mt-3 space-y-1">
                                                            {recommendationReasons.map((reason, index) => (
                                                                <p key={`recommendation-reason-${index}`} className="text-sm opacity-95">{reason}</p>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {nextActionHint && (
                                                        <p className="mt-3 text-sm opacity-95">Next: {nextActionHint}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('timeline')}
                                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                                >
                                    <p className="text-sm font-semibold text-white">Claim Timeline</p>
                                    {openSections.timeline ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                                </button>
                                {openSections.timeline && timelineEvents.length > 0 && (
                                    <div className="px-4 pb-4 border-t border-slate-800/70">
                                        <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-stretch">
                                            {timelineEvents.map((event: any, index: number) => {
                                                const isLatest = index === timelineEvents.length - 1;
                                                const isCurrent = Boolean(event?.metadata?.current);
                                                return (
                                                    <React.Fragment key={`timeline-${index}`}>
                                                        <div className={`min-w-[190px] flex-1 rounded-lg border px-4 py-3 ${isCurrent ? 'border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/10' : isLatest ? 'border-sky-500/30 bg-sky-500/5' : 'border-slate-800 bg-slate-800/30'}`}>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`h-2.5 w-2.5 rounded-full ${isCurrent ? 'bg-blue-300' : isLatest ? 'bg-sky-400' : 'bg-slate-500'}`} />
                                                                    <p className={`text-sm font-semibold ${isCurrent ? 'text-blue-200' : isLatest ? 'text-sky-200' : 'text-white'}`}>{event.label}</p>
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mt-2">{event.timestamp ? new Date(event.timestamp).toLocaleString() : 'N/A'}</p>
                                                            {event.metadata?.reason && <p className="text-xs text-rose-300 mt-2">{event.metadata.reason}</p>}
                                                        </div>
                                                        {index < timelineEvents.length - 1 && (
                                                            <div className="hidden xl:flex min-w-[48px] items-center justify-center">
                                                                <div className="h-px w-full bg-slate-700" />
                                                            </div>
                                                        )}
                                                    </React.Fragment>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants} className="space-y-6 xl:sticky xl:top-28 self-start">
                            {validationSummary && (
                                <>
                                    <div className={`rounded-xl border px-4 py-4 ${confidenceMeta.className}`}>
                                        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Confidence</p>
                                        <p className={`mt-1 text-base font-semibold ${confidenceMeta.valueClassName}`}>{confidenceMeta.display}</p>
                                    </div>

                                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Validation Overview</p>
                                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                            <div>
                                                <p className="text-xs text-slate-500">Checks</p>
                                                <p className="text-base font-semibold text-white">{orderedValidationChecks.length}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Critical</p>
                                                <p className="text-base font-semibold text-rose-300">{orderedValidationChecks.filter((check) => check.severity === 'critical').length}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Warnings</p>
                                                <p className="text-base font-semibold text-amber-300">{orderedValidationChecks.filter((check) => check.severity === 'warning').length}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
                                        <button
                                            type="button"
                                            onClick={() => toggleSection('fieldValidation')}
                                            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                                        >
                                            <p className="text-sm font-semibold text-white">Field Validation Summary</p>
                                            {openSections.fieldValidation ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                                        </button>
                                        {openSections.fieldValidation && (
                                            <div className="px-4 pb-4 border-t border-slate-800/70">
                                                <div className="mt-3 space-y-3">
                                                    {orderedValidationChecks.map((check, index) => {
                                                        const meta = getValidationMeta(check.severity);
                                                        const Icon = meta.icon;
                                                        const isActive = activeValidationCheck === check.type;
                                                        return (
                                                            <button
                                                                key={`validation-check-${index}`}
                                                                type="button"
                                                                onClick={() => handleValidationCheckClick(check)}
                                                                className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-all duration-200 ${meta.className} ${isActive ? 'ring-1 ring-slate-400/40' : ''}`}
                                                            >
                                                                <div className="flex items-center justify-between gap-4">
                                                                    <div className="flex items-start gap-3">
                                                                        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                                                        <div>
                                                                            <p className="font-medium">{check.label}</p>
                                                                            {Array.isArray(check.related_documents) && check.related_documents.length > 0 && (
                                                                                <p className="mt-1 text-xs opacity-80">Related documents: {check.related_documents.map((docType) => getDocumentTypeName(docType)).join(', ')}</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badgeClassName}`}>
                                                                        {check.action_label || meta.actionLabel}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </div>

                    <motion.div variants={itemVariants} className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
                        <button
                            type="button"
                            onClick={() => toggleSection('extractionStatus')}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                        >
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                <p className="text-slate-300"><span className="text-slate-400">Overall Extraction Status:</span> <span className="text-blue-400 font-semibold">{extractingDocId ? 'Processing...' : 'Ready'}</span></p>
                                <p className="text-slate-300"><span className="text-slate-400">Documents Processed:</span> <span className="text-emerald-400 font-semibold">{visibleExtractionOrder.length}</span></p>
                            </div>
                            {openSections.extractionStatus ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                        </button>
                        {openSections.extractionStatus && (
                            <div className="px-4 pb-4 border-t border-slate-800/70">
                                <p className="mt-3 text-sm text-slate-300">
                                    Extraction runs per selected tab and updates confidence/validation in the sticky sidebar.
                                </p>
                            </div>
                        )}
                    </motion.div>

                    <motion.div variants={itemVariants} className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
                        <button
                            type="button"
                            onClick={() => toggleSection('documents')}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                        >
                            <p className="text-sm font-semibold text-white">Documents + Preview + ML Results</p>
                            {openSections.documents ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
                        </button>

                        {openSections.documents && (
                            <div className="px-4 pb-4 border-t border-slate-800/70">
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {processedDocuments.map((doc) => (
                                        <button
                                            key={doc.document_id}
                                            type="button"
                                            onClick={() => handleSelectDocument(doc)}
                                            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${selectedDocument?.document_id === doc.document_id
                                                ? 'border-blue-500 bg-blue-500/15 text-blue-200'
                                                : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600'
                                                }`}
                                        >
                                            {getDocumentTypeName(doc.document_type)}
                                        </button>
                                    ))}
                                </div>

                                {selectedDocument && (
                                    <div className="mt-4 grid grid-cols-1 xl:grid-cols-[20%_45%_35%] gap-4">
                                        <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-4 py-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected Document</p>
                                            <p className="mt-2 text-sm font-medium text-white">{getDocumentTypeName(selectedDocument.document_type)}</p>
                                            <p className="mt-1 text-xs text-slate-400">Claim Status: <span className="text-blue-300">{claimData.claim_status}</span></p>
                                            <p className="mt-1 text-xs text-slate-400">Doc Status: <span className="text-emerald-300 capitalize">{String((selectedDocument as any).document_status || 'issue')}</span></p>
                                            {selectedDocument.review_remarks && (
                                                <p className="mt-2 text-xs text-slate-300">Remarks: {selectedDocument.review_remarks}</p>
                                            )}
                                        </div>

                                        <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-4 flex flex-col min-h-[680px]">
                                            <h3 className="text-base font-semibold text-white mb-3">{getDocumentTypeName(selectedDocument.document_type)} Preview</h3>
                                            <div className="flex items-center justify-center w-full overflow-auto bg-slate-800/30 rounded-lg p-2 flex-1 min-h-[420px]">
                                                {renderDocumentPreview(selectedDocument)}
                                            </div>
                                            <div className="mt-4 border-t border-slate-800/50 pt-4">
                                                {actionFeedback && (
                                                    <div className="mb-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-200">
                                                        {actionFeedback}
                                                    </div>
                                                )}
                                                {isApprovedClaim ? (
                                                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
                                                        This claim is approved and locked.
                                                    </div>
                                                ) : !isPendingLikeClaim ? (
                                                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
                                                        This claim is rejected and locked.
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex gap-3 mt-1">
                                                            <button
                                                                type="button"
                                                                className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-medium px-4 py-2 rounded-lg shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300 disabled:opacity-60"
                                                                disabled={reviewSaving || Boolean(coverageSummary?.exceeds_remaining_coverage)}
                                                                onClick={handleApproveClaim}
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
                                                        <div className="mt-4">
                                                            <p className="text-sm font-semibold text-white mb-3">Document Review Status</p>
                                                            <textarea
                                                                className="w-full mb-3 border border-slate-700 bg-slate-800/50 text-slate-200 placeholder:text-slate-500 rounded-lg p-3 text-sm focus:border-blue-500/50 focus:ring-blue-500/20 focus:outline-none focus:ring-2"
                                                                rows={2}
                                                                placeholder="Add remarks for this selected document..."
                                                                value={documentRemarks}
                                                                onChange={(e) => setDocumentRemarks(e.target.value)}
                                                            />
                                                            <div className="flex flex-wrap gap-2">
                                                                <button
                                                                    type="button"
                                                                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium px-4 py-2 rounded-lg transition-all duration-300 disabled:opacity-60"
                                                                    disabled={documentActionLoading || (selectedDocument as any)?.is_missing}
                                                                    onClick={() => updateSelectedDocumentStatus('verified')}
                                                                >
                                                                    Mark Verified
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium px-4 py-2 rounded-lg transition-all duration-300 disabled:opacity-60"
                                                                    disabled={documentActionLoading || (selectedDocument as any)?.is_missing}
                                                                    onClick={() => updateSelectedDocumentStatus('issue')}
                                                                >
                                                                    Mark Issue
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium px-4 py-2 rounded-lg transition-all duration-300 disabled:opacity-60"
                                                                    disabled={documentActionLoading || (selectedDocument as any)?.is_missing}
                                                                    onClick={() => updateSelectedDocumentStatus('missing')}
                                                                >
                                                                    Mark Missing
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                                {showRejectRemarks && (
                                                    <div className="mt-4 border-t border-slate-800/50 pt-4">
                                                        <textarea
                                                            className="w-full border border-slate-700 bg-slate-800/50 text-slate-200 placeholder:text-slate-500 rounded-lg p-3 text-sm focus:border-blue-500/50 focus:ring-blue-500/20 focus:outline-none focus:ring-2"
                                                            rows={3}
                                                            placeholder="Add rejection remarks..."
                                                            value={claimRejectionRemarks}
                                                            onChange={(e) => setClaimRejectionRemarks(e.target.value)}
                                                        />
                                                        <div className="flex gap-3 mt-3">
                                                            <button
                                                                type="button"
                                                                className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-medium px-4 py-2 rounded-lg shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 disabled:opacity-60"
                                                                disabled={reviewSaving}
                                                                onClick={handleRejectClaim}
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

                                        <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-4 min-h-[680px]">
                                            <h3 className="text-base font-semibold text-white mb-3">ML Extraction Results</h3>
                                            <div className="h-full overflow-y-auto overflow-x-hidden pr-1">
                                                {!shouldShowExtractionSections ? (
                                                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                                                        <p className="text-slate-300">ML extraction is not required for this document type.</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {extractingDocId && (
                                                            <div className="mb-4 text-sm text-blue-400">Running extraction for selected document...</div>
                                                        )}
                                                        {visibleExtractionOrder.length === 0 ? (
                                                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                                                                <p className="text-slate-300">Select a document tab to run extraction</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {visibleExtractionOrder.map((docId) => {
                                                                    const extractedDoc = processedDocuments.find((d) => d.document_id === docId);
                                                                    if (!extractedDoc) return null;
                                                                    const content = renderMLExtractionResults(extractedDoc.document_type, extractionByDocId[docId]);
                                                                    if (!content) return null;
                                                                    return <div key={docId}>{content}</div>;
                                                                })}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            </div>

        </div>
    );
};

export default AdminClaimReview;

