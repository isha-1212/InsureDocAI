import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/types/routes";
import { supabase } from "@/lib/supabase";
import { apiClient } from "@/lib/api-client";
import { useUpdatePolicyStatus } from "@/hooks/use-policies";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, FileText, X, Download, Maximize2 } from "lucide-react";
import { format } from "date-fns";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Animation variants - scale and fade
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.05
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 120,
            damping: 20,
            duration: 0.6
        }
    }
};

export default function PolicyDetail() {
    const [, params] = useRoute("/admin/policies/:id");
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { mutate: updateStatus, isPending } = useUpdatePolicyStatus();

    const policyId = params?.id ? Number(params.id) : NaN;

    const [docUrl, setDocUrl] = useState<string | null>(null);
    const [docType, setDocType] = useState<string | null>(null);
    const [docError, setDocError] = useState<string | null>(null);
    const [viewerError, setViewerError] = useState<string | null>(null);

    const [action, setAction] = useState<"approved" | "rejected" | null>(null);
    const [reason, setReason] = useState("");

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDecision, setPendingDecision] = useState<"approved" | "rejected" | null>(null);

    const { data: policy, isLoading } = useQuery({
        queryKey: ["policy-detail", policyId],
        enabled: Number.isFinite(policyId),
        queryFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                throw new Error("Not authenticated");
            }

            const res = await fetch(api.policies.getById(String(policyId)), {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                throw new Error("Failed to fetch policy details");
            }

            return res.json();
        },
    });

    useEffect(() => {
        const loadDocument = async () => {
            if (!policy || !policy.has_document) return;
            try {
                const result = await apiClient.getPolicyDocument(policy.id);
                console.log('Document result:', result);

                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                if (!token) {
                    throw new Error('Not authenticated');
                }

                const response = await fetch(result.signed_url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch document: ${response.status}`);
                }

                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                setDocUrl(blobUrl);
                setDocType(blob.type);
                setDocError(null);
                setViewerError(null);
            } catch (err: any) {
                console.error('Document load error:', err);
                setDocError("We couldn't load this document. Please try again.");
                setViewerError("We couldn't load this document. Please try again.");
            }
        };

        loadDocument();

        // Cleanup blob URL on unmount
        return () => {
            if (docUrl && docUrl.startsWith('blob:')) {
                URL.revokeObjectURL(docUrl);
            }
        };
    }, [policy]);

    const openConfirm = (decision: "approved" | "rejected") => {
        if (decision === "rejected" && !reason.trim()) {
            toast({
                title: "Rejection reason required",
                description: "Please provide a reason for rejection.",
                variant: "destructive",
            });
            return;
        }
        setPendingDecision(decision);
        setConfirmOpen(true);
    };

    const handleConfirmDecision = () => {
        if (!pendingDecision) return;

        if (pendingDecision === "approved") {
            updateStatus(
                { id: policyId, status: "approved" },
                {
                    onSuccess: () => {
                        setConfirmOpen(false);
                        setLocation("/admin/policies");
                    },
                }
            );
        } else {
            updateStatus(
                { id: policyId, status: "rejected", rejectionReason: reason },
                {
                    onSuccess: () => {
                        setConfirmOpen(false);
                        setLocation("/admin/policies");
                    },
                }
            );
        }
    };

    if (!Number.isFinite(policyId)) {
        return (
            <Layout>
                <div className="pt-20 text-center text-slate-400">Invalid policy ID.</div>
            </Layout>
        );
    }

    if (isLoading || !policy) {
        return (
            <Layout>
                <div className="pt-20 text-center text-slate-400">Loading policy details...</div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-6 py-6">
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="space-y-6"
                >
                    {/* Back button */}
                    <motion.div variants={itemVariants}>
                        <Button
                            variant="ghost"
                            onClick={() => setLocation("/admin/policies")}
                            className="gap-2 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium transition-all duration-300"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to policies
                        </Button>
                    </motion.div>

                    {/* Header */}
                    <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-display font-bold text-white">Policy Detail</h1>
                            <p className="text-sm text-slate-400 mt-1">
                                User ID: <span className="font-mono text-blue-400">{policy.user_id}</span> ·
                                {" "}
                                Policy Number: <span className="font-mono text-blue-400">{policy.policy_number}</span>
                            </p>
                        </div>
                        <StatusBadge status={policy.status} />
                    </motion.div>

                    {/* Main Grid */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        {/* Left: Document preview (col-span-2) */}
                        <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Policy Document</h2>
                                    <p className="text-sm text-slate-400">View the file provided by the user</p>
                                </div>
                                {docUrl && !docError && !viewerError && (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium transition-all duration-300"
                                            onClick={() => {
                                                if (docUrl) {
                                                    const a = document.createElement('a');
                                                    a.href = docUrl;
                                                    a.download = `policy-${policy.policy_number}.${docType?.split('/')[1] || 'pdf'}`;
                                                    a.click();
                                                }
                                            }}
                                        >
                                            <Download className="w-4 h-4 mr-1" /> Download
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium transition-all duration-300"
                                            onClick={() => {
                                                if (docUrl) {
                                                    window.open(docUrl, '_blank');
                                                }
                                            }}
                                        >
                                            <Maximize2 className="w-4 h-4 mr-1" /> Fullscreen
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className="w-full min-h-[400px] max-h-[600px] overflow-auto rounded-lg border border-slate-800/50 bg-slate-950 flex items-center justify-center">
                                {docUrl && !docError && !viewerError && (
                                    docType?.startsWith('image/') ? (
                                        <img
                                            src={docUrl}
                                            alt="Policy document"
                                            className="max-w-full max-h-[550px] object-contain mx-auto"
                                            onError={() => setViewerError("We couldn't display this document.")}
                                        />
                                    ) : (
                                        <iframe
                                            src={docUrl}
                                            title="Policy document"
                                            className="w-full h-[550px]"
                                            onError={() => setViewerError("We couldn't display this document.")}
                                        />
                                    )
                                )}

                                {(!policy.has_document || docError || viewerError || !docUrl) && (
                                    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
                                        <div className="mb-4 rounded-full bg-slate-800/50 p-4">
                                            <FileText className="w-8 h-8 text-slate-400" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-200">
                                            {policy.has_document
                                                ? "We couldn't display this document"
                                                : "No policy document uploaded"}
                                        </p>
                                        <p className="mt-2 text-xs text-slate-400 max-w-sm">
                                            {policy.has_document
                                                ? "The file may be missing or temporarily unavailable. You can try again or ask the user to re-upload."
                                                : "The user has not uploaded their policy document yet."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Policy info (col-span-1) */}
                        <div className="lg:col-span-1 bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Policy Information</h2>

                            {/* Structured info grid */}
                            <div className="grid grid-cols-1 gap-4">
                                {/* User */}
                                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                                    <span className="text-xs text-slate-400 uppercase">User</span>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-slate-200">{policy.user_name || policy.user_email}</p>
                                        <p className="text-xs text-slate-300 font-mono">ID: {policy.user_id}</p>
                                    </div>
                                </div>

                                {/* Start Date */}
                                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                                    <span className="text-xs text-slate-400 uppercase">Start Date</span>
                                    <span className="text-sm font-mono text-slate-200">
                                        {(() => {
                                            try {
                                                const d = new Date(policy.start_date);
                                                if (isNaN(d.getTime())) return policy.start_date;
                                                return format(d, "dd MMM yyyy");
                                            } catch {
                                                return policy.start_date;
                                            }
                                        })()}
                                    </span>
                                </div>

                                {/* End Date */}
                                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                                    <span className="text-xs text-slate-400 uppercase">End Date</span>
                                    <span className="text-sm font-mono text-slate-200">
                                        {(() => {
                                            try {
                                                const d = new Date(policy.end_date);
                                                if (isNaN(d.getTime())) return policy.end_date;
                                                return format(d, "dd MMM yyyy");
                                            } catch {
                                                return policy.end_date;
                                            }
                                        })()}
                                    </span>
                                </div>

                                {/* Policy Number */}
                                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                                    <span className="text-xs text-slate-400 uppercase">Policy Number</span>
                                    <span className="text-sm font-mono text-slate-200">{policy.policy_number}</span>
                                </div>

                                {/* Family Members */}
                                {Array.isArray(policy.family_members) && policy.family_members.length > 0 && (
                                    <div className="pt-2">
                                        <p className="text-xs text-slate-400 uppercase mb-3">Family Members</p>
                                        <div className="space-y-2">
                                            {policy.family_members.map((member: any) => (
                                                <div key={member.id} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium text-slate-200">{member.name}</span>
                                                        <span className="text-xs text-slate-400 uppercase">{member.relation}</span>
                                                    </div>
                                                    {member.dob && (
                                                        <p className="text-xs text-slate-400 mt-1">DOB: {member.dob}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Rejection remarks */}
                            {action === "rejected" && (
                                <div className="mt-6">
                                    <p className="text-xs text-slate-400 uppercase mb-2">Rejection Remarks</p>
                                    <Textarea
                                        placeholder="Enter reason for rejection..."
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        className="min-h-[100px] bg-slate-800/50 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                                    />
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-3 mt-6 justify-end">
                                {action !== "rejected" ? (
                                    <>
                                        <Button
                                            className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-medium rounded-lg shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300"
                                            onClick={() => setAction("rejected")}
                                            disabled={isPending}
                                        >
                                            <X className="w-4 h-4 mr-2" /> Reject
                                        </Button>
                                        <Button
                                            className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-medium rounded-lg shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300"
                                            onClick={() => openConfirm("approved")}
                                            disabled={isPending}
                                        >
                                            <Check className="w-4 h-4 mr-2" /> Approve
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="ghost"
                                            className="text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg font-medium transition-all duration-300"
                                            onClick={() => setAction(null)}
                                            disabled={isPending}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            className="bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white font-medium rounded-lg shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 transition-all duration-300"
                                            onClick={() => openConfirm("rejected")}
                                            disabled={isPending}
                                        >
                                            Confirm Rejection
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingDecision === "approved"
                                ? "Approve this policy?"
                                : "Reject this policy?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDecision === "approved"
                                ? "This will mark the policy as approved and allow the user to proceed with claims."
                                : "This will mark the policy as rejected. The user will see your remarks on their dashboard."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDecision}
                            disabled={isPending}
                        >
                            {pendingDecision === "approved" ? "Yes, approve" : "Yes, reject"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Layout>
    );
}
