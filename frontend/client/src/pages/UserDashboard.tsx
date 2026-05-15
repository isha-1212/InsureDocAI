import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-users";
import { usePolicies } from "@/hooks/use-policies";
import { useUserClaims } from "@/hooks/use-claims";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertPolicySchema } from "@/types/schema";
import { FileText, Plus, ShieldAlert, Clock, AlertTriangle, Upload, X, Users, TrendingUp, CheckCircle, XCircle, IndianRupee, Calendar, ZoomIn, ZoomOut, Download, FilePenLine, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function UserDashboard() {
  const [location] = useLocation();
  const { userId, name } = useAuth();
  const { data: policy, isLoading: policyLoading } = usePolicies(userId!);
  const { data: claims, isLoading: claimsLoading } = useUserClaims(userId!);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Move all state and derived values to the top to avoid hook order issues
  const isMyClaimsPage = location === "/portal/claims";

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string>("");
  const [viewerDocumentName, setViewerDocumentName] = useState<string>("Document");
  const [documentZoom, setDocumentZoom] = useState(100);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string>("");
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [editMemberId, setEditMemberId] = useState<string>("");
  const [editTotalAmount, setEditTotalAmount] = useState<string>("");
  const [claimActionLoading, setClaimActionLoading] = useState<string>("");
  const [expandedClaimIds, setExpandedClaimIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    resolver: zodResolver(insertPolicySchema),
    defaultValues: {
      policy_number: "",
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), "yyyy-MM-dd"),
    }
  });

  // Calculate derived values after all hooks
  const allClaims: any[] = claims || [];
  const totalClaims = allClaims.length;
  const totalPendingClaims = allClaims.filter((c) => String(c.status || "").toLowerCase() === "pending").length;
  const totalApprovedAmount = allClaims
    .filter((c) => String(c.status || "").toLowerCase() === "approved")
    .reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0);
  const recentClaims = allClaims.slice(0, 5);
  const dashboardRecentClaims = allClaims.slice(0, 3);

  useEffect(() => {
    if (!isMyClaimsPage) return;
    if (allClaims.length > 0 && allClaims.length <= 2) {
      setExpandedClaimIds(new Set([String(allClaims[0].id)]));
      return;
    }
    setExpandedClaimIds(new Set());
  }, [isMyClaimsPage, allClaims]);

  const toggleClaimExpanded = (claimId: string) => {
    setExpandedClaimIds((prev) => {
      const next = new Set(prev);
      if (next.has(claimId)) {
        next.delete(claimId);
      } else {
        next.add(claimId);
      }
      return next;
    });
  };

  const isPending = policy?.status === "pending";
  const isUnderReview = policy?.status === "under_review";
  const isRejected = policy?.status === "rejected";
  const availableMembers = Array.isArray((policy as any)?.familyMembers)
    ? (policy as any).familyMembers
    : Array.isArray((policy as any)?.family_members)
      ? (policy as any).family_members
      : [];
  const totalCoverage = Number((policy as any)?.total_coverage_amount || 0);
  const usedCoverage = Number((policy as any)?.used_coverage_amount || 0);
  const remainingCoverage = Number((policy as any)?.remaining_coverage_amount || Math.max(totalCoverage - usedCoverage, 0));
  const usedCoveragePct = totalCoverage > 0 ? Math.min((usedCoverage / totalCoverage) * 100, 100) : 0;
  const usedCoveragePctRounded = Math.round(usedCoveragePct);
  const firstName = (name || "Isha").trim().split(" ")[0] || "Isha";
  const now = new Date();
  const greetingPrefix = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const formattedToday = format(now, "EEE, MMM d, yyyy");
  const policyIdentifier =
    (policy as any)?.policyNumber ||
    (policy as any)?.policy_number ||
    (policy as any)?.policyNo ||
    "-";

  const formatDocumentType = (value: string) => {
    const map: Record<string, string> = {
      hospital_bill: "Hospital Bill",
      pharmacy_bill: "Pharmacy Bill",
      aadhaar: "Aadhaar",
      pan: "PAN",
      birth_certificate: "Birth Certificate",
    };
    return map[value] || value;
  };

  const getDocumentRemark = (claim: any, doc: any) => {
    const documentRemark = String(doc?.remarks || "").trim();
    const claimReason = String(claim?.rejectionReason || "").trim();

    if (!documentRemark) return "";
    if (claimReason && documentRemark.toLowerCase() === claimReason.toLowerCase()) return "";
    return documentRemark;
  };

  const formatTimelineLabel = (eventType: string) =>
    eventType.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());

  const getDocumentStatusStyle = (documentStatus?: string) => {
    if (documentStatus === "verified") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    if (documentStatus === "missing") return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    return "bg-rose-500/10 text-rose-400 border-rose-500/30";
  };

  const resolveViewUrl = (rawUrl?: string) => {
    if (!rawUrl) return "#";
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) return rawUrl;
    return `http://localhost:8000${rawUrl}`;
  };

  const closeDocumentViewer = () => {
    if (viewerUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(viewerUrl);
    }
    setViewerOpen(false);
    setViewerUrl("");
    setViewerError(null);
    setViewerLoading(false);
  };

  const openDocumentViewer = async (rawUrl?: string, documentName?: string) => {
    const url = resolveViewUrl(rawUrl);
    if (!url || url === "#") return;

    setViewerOpen(true);
    setViewerDocumentName(documentName || "Document");
    setViewerLoading(true);
    setViewerError(null);
    setDocumentZoom(100);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const isSupabaseSignedUrl = /^https?:\/\/.*\.supabase\.co\//i.test(url);
      const response = await fetch(url, {
        cache: "no-store",
        headers: isSupabaseSignedUrl ? undefined : { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Failed to load document preview (${response.status})`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setViewerUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return blobUrl;
      });
    } catch (error: any) {
      setViewerError(error?.message || "Failed to load document preview");
      setViewerUrl("");
    } finally {
      setViewerLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (viewerUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(viewerUrl);
      }
    };
  }, [viewerUrl]);

  const handleReuploadFileChange = async (
    claimId: string,
    documentType: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const currentKey = `${claimId}:${documentType}`;
    setUploadingKey(currentKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append(documentType, file);

      const response = await fetch(`http://localhost:8000/api/claims/${claimId}/reupload/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to reupload document");
      }

      toast({
        title: "Reuploaded",
        description: `${formatDocumentType(documentType)} replaced in existing claim.`,
      });
      queryClient.invalidateQueries();
    } catch (error: any) {
      toast({
        title: "Reupload failed",
        description: error?.message || "Could not upload file",
        variant: "destructive",
      });
    } finally {
      setUploadingKey("");
      event.target.value = "";
    }
  };

  const startEditingClaim = (claim: any) => {
    setEditingClaimId(claim.id);
    setEditMemberId(String(claim.member?.id || ""));
    setEditTotalAmount(String(claim.totalAmount || ""));
  };

  const cancelEditingClaim = () => {
    setEditingClaimId(null);
    setEditMemberId("");
    setEditTotalAmount("");
  };

  const handleSaveClaimEdit = async (claimId: string) => {
    try {
      setClaimActionLoading(`edit:${claimId}`);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`http://localhost:8000/api/claims/${claimId}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          member_id: editMemberId,
          total_amount: editTotalAmount,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || "Failed to update claim");
      }

      toast({
        title: "Claim updated",
        description: "Changes were saved. Reapply when you are ready.",
      });
      cancelEditingClaim();
      queryClient.invalidateQueries();
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error?.message || "Could not update claim",
        variant: "destructive",
      });
    } finally {
      setClaimActionLoading("");
    }
  };

  const handleReapplyClaim = async (claimId: string) => {
    try {
      setClaimActionLoading(`reapply:${claimId}`);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(`http://localhost:8000/api/claims/${claimId}/reapply/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || "Failed to reapply claim");
      }

      toast({
        title: "Claim reapplied",
        description: "The claim has been sent back to admin for review.",
      });
      queryClient.invalidateQueries();
    } catch (error: any) {
      toast({
        title: "Reapply failed",
        description: error?.message || "Could not reapply claim",
        variant: "destructive",
      });
    } finally {
      setClaimActionLoading("");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or image file (JPG, PNG)",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    setUploadedFile(file);
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (data: z.infer<typeof insertPolicySchema>) => {
    if (!uploadedFile) {
      toast({
        title: "No file selected",
        description: "Please upload a policy document",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("policy_number", data.policy_number);
      formData.append("start_date", data.start_date);
      formData.append("end_date", data.end_date);

      const response = await fetch("http://localhost:8000/api/upload-policy-document/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        const fieldErrors = Object.entries(error || {})
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
          .join(" | ");
        throw new Error(error.error || error.message || fieldErrors || "Upload failed");
      }

      const result = await response.json();

      toast({ title: "Success!", description: result.message || "Policy registered successfully" });

      queryClient.invalidateQueries({ queryKey: ["user-policy"] });
      setDialogOpen(false);
      form.reset();
      setUploadedFile(null);
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message || "Failed to register policy",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (policyLoading || claimsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full pt-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!policy) {
    return (
      <Layout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto text-center pt-20"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30 backdrop-blur-sm">
            <ShieldAlert className="w-12 h-12 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">No Active Policy Found</h1>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Please register your health insurance policy to manage family members and submit claims.
          </p>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-full px-8 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all">
                <Plus className="w-4 h-4 mr-2" />
                Register Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white">Register New Policy</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Enter your policy details and upload the policy document.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="policy_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Policy Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="INS-2026-FAM-000123"
                            {...field}
                            onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <FormLabel className="text-slate-300">Policy Document (Image)</FormLabel>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="border-2 border-dashed border-slate-700 bg-slate-800/50 rounded-lg p-6 text-center hover:bg-slate-800 hover:border-slate-600 transition-colors cursor-pointer block backdrop-blur-sm"
                    >
                      {uploadedFile ? (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-8 h-8 text-emerald-400" />
                            <div className="text-left min-w-0">
                              <p className="text-sm font-medium text-slate-200 truncate">{uploadedFile.name}</p>
                              <p className="text-xs text-slate-400">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); removeFile(); }} className="hover:bg-slate-700 text-slate-400 hover:text-slate-200">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <p className="text-sm text-slate-300">Click to upload or drag and drop</p>
                          <p className="text-xs text-slate-500 mt-1">JPEG, JPG, PNG (max 5MB)</p>
                        </>
                      )}
                    </label>
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white" disabled={isSubmitting || !uploadedFile}>
                    {isSubmitting ? "Submitting..." : "Submit Policy"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </motion.div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-5 sm:py-8 space-y-7 sm:space-y-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            {isMyClaimsPage ? (
              <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                My Claims
              </h2>
            ) : (
              <>
                <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
                  {greetingPrefix}, {firstName} <span aria-hidden="true">👋</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">Manage your health coverage</p>
              </>
            )}
          </div>
          {!isMyClaimsPage && (
            <p className="text-xs sm:text-sm text-slate-500 md:text-right">{formattedToday}</p>
          )}
          {isMyClaimsPage && (
            <Link href="/portal/claims/new">
              <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium px-5 py-2.5 rounded-lg shadow-lg hover:shadow-blue-500/40 transition-all duration-300">
                <Plus className="w-4 h-4 mr-2" />
                New Claim
              </Button>
            </Link>
          )}
        </motion.div>

        {!isMyClaimsPage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="relative bg-slate-900/65 backdrop-blur border border-slate-800 overflow-hidden shadow-[0_12px_32px_rgba(15,23,42,0.35)]">
              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-cyan-400 via-teal-400 to-blue-500" />
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-white font-semibold font-mono tracking-wide">Policy #{policyIdentifier}</p>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${isRejected
                    ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                    : (isPending || isUnderReview)
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                      : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isRejected ? "bg-rose-400" : (isPending || isUnderReview) ? "bg-amber-400" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)]"
                      }`} />
                    {isRejected ? "Rejected" : isUnderReview ? "Under Review" : isPending ? "Pending Verification" : "Approved"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-3 space-y-3">
                <div className="h-px bg-slate-800" />

                {isRejected && (
                  <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {policy.rejectionReason || "Policy rejected. Please contact support."}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg border border-blue-400/25 bg-blue-500/15 px-2.5 py-1 text-blue-100 transition-all hover:shadow-[0_0_12px_rgba(59,130,246,0.35)]">Members: {policy.members?.length || 0}</span>
                  <span className="rounded-lg border border-violet-400/25 bg-violet-500/15 px-2.5 py-1 text-violet-100 transition-all hover:shadow-[0_0_12px_rgba(139,92,246,0.35)]">Claims: {totalClaims}</span>
                  <span className="rounded-lg border border-amber-400/25 bg-amber-500/15 px-2.5 py-1 text-amber-100 transition-all hover:shadow-[0_0_12px_rgba(251,191,36,0.35)]">Pending: {totalPendingClaims}</span>
                  <span className="rounded-lg border border-emerald-400/25 bg-emerald-500/15 px-2.5 py-1 text-emerald-100 transition-all hover:shadow-[0_0_12px_rgba(52,211,153,0.35)]">Approved: ₹{Math.round(totalApprovedAmount).toLocaleString('en-IN')}</span>
                  <span className="rounded-lg border border-teal-400/25 bg-teal-500/15 px-2.5 py-1 text-teal-100 transition-all hover:shadow-[0_0_12px_rgba(45,212,191,0.35)]">Remaining: ₹{Math.round(remainingCoverage).toLocaleString('en-IN')}</span>
                  <Link href="/portal/claims/new">
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                      disabled={isPending || isRejected}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      New Claim
                    </Button>
                  </Link>
                </div>

                <div className="rounded-md border border-slate-800 bg-slate-800/30 px-3 py-2">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Policy Coverage</p>
                    <p className="text-xs text-slate-300">{usedCoveragePctRounded}% used</p>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-700 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${usedCoveragePct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
                      className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    ₹{Math.round(usedCoverage).toLocaleString('en-IN')} used of ₹{Math.round(totalCoverage).toLocaleString('en-IN')} | ₹{Math.round(remainingCoverage).toLocaleString('en-IN')} remaining
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!isMyClaimsPage ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-2"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="h-5 w-1.5 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
                Recent Claims
              </h2>
              <Link href="/portal/claims" className="text-sm text-blue-400 font-medium hover:text-blue-300 transition-colors">View All</Link>
            </div>

            {claimsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-slate-900/50 p-5 rounded-xl border border-slate-800/50 animate-pulse">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="h-6 bg-slate-700/50 rounded w-32 mb-2"></div>
                        <div className="h-4 bg-slate-700/30 rounded w-48"></div>
                      </div>
                      <div className="h-20 bg-slate-700/30 rounded w-24"></div>
                    </div>
                    <div className="h-16 bg-slate-700/20 rounded"></div>
                  </div>
                ))}
              </div>
            ) : dashboardRecentClaims.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12 bg-gradient-to-br from-slate-900/60 via-slate-800/40 to-slate-900/60 rounded-xl border border-slate-700/50 backdrop-blur-sm"
              >
                <div className="max-w-md mx-auto">
                  <div className="w-20 h-20 bg-gradient-to-br from-slate-800/80 to-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-600/50 shadow-lg">
                    <FileText className="w-10 h-10 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">No Claims Yet</h3>
                  <p className="text-slate-400 mb-5 text-sm leading-relaxed px-4">
                    You haven't submitted any claims. Start your first claim in just a few clicks.
                  </p>
                  {/* Submit New Claim button removed per UX request */}
                </div>
              </motion.div>
            ) : (
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/55 shadow-[0_8px_24px_rgba(15,23,42,0.25)]">
                <div className="grid grid-cols-[2.1fr_1.1fr_1fr_1fr_1fr] gap-2 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-800 bg-slate-900/80">
                  <span>Claim ID</span>
                  <span>For</span>
                  <span>Date</span>
                  <span>Status</span>
                  <span className="text-right">Amount</span>
                </div>
                <div className="divide-y divide-slate-800">
                  {dashboardRecentClaims.map((claim, idx) => {
                    const status = String(claim.status || "").toLowerCase();
                    const statusColors = {
                      approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
                      pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
                      rejected: "bg-red-500/15 text-red-300 border-red-500/30",
                      default: "bg-slate-500/10 text-slate-300 border-slate-500/30"
                    };
                    const statusColor = statusColors[status as keyof typeof statusColors] || statusColors.default;
                    const statusIcon = status === "approved" ? "✓" : status === "rejected" ? "✗" : "⏳";
                    const claimId = String(claim.id || "");
                    const truncatedClaimId = claimId.length > 14 ? `${claimId.slice(0, 10)}...` : claimId;
                    return (
                      <Link href="/portal/claims" key={claim.id} className={`block transition-colors ${idx % 2 === 1 ? "bg-slate-800/20" : "bg-transparent"} hover:bg-slate-800/50`}>
                        <div className="grid grid-cols-[2.1fr_1.1fr_1fr_1fr_1fr] gap-2 px-3 py-2.5 text-sm items-center min-h-[48px]">
                          <span className="text-slate-200 font-medium truncate font-mono" title={claimId}>{truncatedClaimId}</span>
                          <span className="text-slate-300 truncate">{claim.member?.name || "Policy holder"}</span>
                          <span className="text-slate-400">{claim.submittedDate ? format(new Date(claim.submittedDate), "MMM dd") : "N/A"}</span>
                          <span className={`inline-flex w-fit items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border uppercase ${statusColor}`}>
                            <span>{statusIcon}</span>
                            {status}
                          </span>
                          <span className="text-right text-slate-100 font-medium">₹{Math.round(Number(claim.totalAmount || 0)).toLocaleString('en-IN')}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {claimsLoading ? (
              <div className="space-y-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800/50 animate-pulse">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="h-7 bg-slate-700/50 rounded w-40 mb-3"></div>
                        <div className="h-4 bg-slate-700/30 rounded w-56 mb-2"></div>
                        <div className="h-4 bg-slate-700/30 rounded w-32"></div>
                      </div>
                      <div className="h-24 bg-slate-700/30 rounded w-28"></div>
                    </div>
                    <div className="border-t border-slate-700/50 pt-4 mt-4">
                      <div className="h-5 bg-slate-700/30 rounded w-24 mb-3"></div>
                      <div className="space-y-2">
                        <div className="h-16 bg-slate-700/20 rounded"></div>
                        <div className="h-16 bg-slate-700/20 rounded"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : allClaims.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 bg-gradient-to-br from-slate-900/60 via-slate-800/40 to-slate-900/60 rounded-2xl border border-slate-700/50 backdrop-blur-sm"
              >
                <div className="max-w-md mx-auto">
                  <div className="w-24 h-24 bg-gradient-to-br from-slate-800/80 to-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-slate-600/50 shadow-xl">
                    <FileText className="w-12 h-12 text-slate-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">No Claims Submitted</h3>
                  <p className="text-slate-400 mb-8 leading-relaxed">
                    Get started by submitting your first insurance claim. It's quick and easy!
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {allClaims.map((claim, index) => {
                  const status = String(claim.status || "").toLowerCase();
                  const statusColors = {
                    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                    pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
                    rejected: "bg-red-500/10 text-red-400 border-red-500/30",
                    reapplied: "bg-sky-500/10 text-sky-400 border-sky-500/30",
                    default: "bg-slate-500/10 text-slate-400 border-slate-500/30"
                  };
                  const statusColor = statusColors[status as keyof typeof statusColors] || statusColors.default;
                  const StatusIcon = status === 'approved' ? CheckCircle : status === 'rejected' ? XCircle : status === 'reapplied' ? RotateCcw : Clock;
                  const isRejectedClaim = status === "rejected";
                  const isEditing = editingClaimId === claim.id;
                  const isExpanded = expandedClaimIds.has(String(claim.id));

                  return (
                    <motion.div
                      key={claim.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -1 }}
                      transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 25 }}
                      className="bg-gradient-to-br from-slate-900/90 to-slate-900/50 rounded-xl border border-slate-800/60 px-4 py-3 backdrop-blur-sm hover:border-slate-700/80 transition-all duration-300 shadow-lg hover:shadow-xl group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <button
                        type="button"
                        onClick={() => toggleClaimExpanded(String(claim.id))}
                        className="w-full relative z-10 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30 text-sm">
                            ₹
                          </div>
                          <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <p className="font-semibold text-white truncate">Claim #{claim.id}</p>
                            <span className="text-slate-500">|</span>
                            <p className="text-slate-300 truncate">For: {claim.member?.name || "Policy holder"}</p>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusColor} font-medium uppercase tracking-wide flex items-center gap-1`}>
                              <StatusIcon className="w-3 h-3" />
                              {status}
                            </span>
                            <span className="font-semibold text-white">₹{claim.totalAmount && claim.totalAmount > 0 ? claim.totalAmount : "0"}</span>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-slate-300 text-sm whitespace-nowrap">
                          Expand
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="relative z-10 mt-3 border-t border-slate-800/70 pt-3 space-y-3">

                          {claim.rejectionReason && (
                            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
                              <p className="text-xs font-semibold text-rose-300">Rejection Reason</p>
                              <p className="mt-1 text-xs text-rose-200">{claim.rejectionReason}</p>
                            </div>
                          )}

                          {isRejectedClaim && (
                            <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-3">
                              {isEditing ? (
                                <div className="space-y-4">
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-slate-300">Member</label>
                                      <select
                                        value={editMemberId}
                                        onChange={(e) => setEditMemberId(e.target.value)}
                                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                                      >
                                        {availableMembers.map((member: any) => (
                                          <option key={member.id} value={member.id}>
                                            {member.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-slate-300">Claim Amount</label>
                                      <Input
                                        type="number"
                                        value={editTotalAmount}
                                        onChange={(e) => setEditTotalAmount(e.target.value)}
                                        className="border-slate-700 bg-slate-900 text-slate-100"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      onClick={() => handleSaveClaimEdit(claim.id)}
                                      disabled={claimActionLoading === `edit:${claim.id}`}
                                      className="bg-blue-600 hover:bg-blue-500 text-white"
                                    >
                                      {claimActionLoading === `edit:${claim.id}` ? "Saving..." : "Save Edit"}
                                    </Button>
                                    <Button type="button" variant="outline" onClick={cancelEditingClaim}>
                                      Cancel
                                    </Button>
                                  </div>
                                  <p className="text-xs text-slate-400">
                                    Editing keeps the claim rejected until you explicitly click Reapply.
                                  </p>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    onClick={() => startEditingClaim(claim)}
                                    className="bg-slate-700 hover:bg-slate-600 text-white"
                                  >
                                    <FilePenLine className="mr-2 h-4 w-4" />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => handleReapplyClaim(claim.id)}
                                    disabled={claimActionLoading === `reapply:${claim.id}`}
                                    className="bg-sky-600 hover:bg-sky-500 text-white"
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    {claimActionLoading === `reapply:${claim.id}` ? "Reapplying..." : "Reapply"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          {Array.isArray(claim.changeSummary) && claim.changeSummary.length > 0 && (
                            <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                              <p className="text-sm font-semibold text-sky-300 mb-2">Changes Since Last Rejection</p>
                              <div className="space-y-1">
                                {claim.changeSummary.map((change: any, idx: number) => (
                                  <p key={`${claim.id}-change-${idx}`} className="text-xs text-slate-300">
                                    {change.label}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          {Array.isArray(claim.timeline) && claim.timeline.length > 0 && (
                            <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-3">
                              <p className="text-xs font-semibold text-white mb-2">Timeline</p>
                              <div className="overflow-x-auto">
                                <div className="flex items-start gap-2 min-w-[620px]">
                                  {claim.timeline.map((event: any, idx: number) => {
                                    const isCurrent = idx === claim.timeline.length - 1;
                                    return (
                                      <div key={`${claim.id}-timeline-${idx}`} className="flex items-start gap-2">
                                        <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-sky-400" />
                                        <div>
                                          <p className={`text-xs font-semibold ${isCurrent ? 'text-sky-300' : 'text-slate-200'}`}>
                                            {event.label || formatTimelineLabel(event.eventType || "")}
                                          </p>
                                          <p className="text-[11px] text-slate-500 mt-0.5">
                                            {event.timestamp ? format(new Date(event.timestamp), "MMM dd") : "N/A"}
                                          </p>
                                        </div>
                                        {idx < claim.timeline.length - 1 && <div className="mt-2.5 h-px w-8 bg-slate-700" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="border-t border-slate-700/50 pt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-slate-400" />
                              <p className="text-xs font-semibold text-white">Documents</p>
                            </div>
                            {!claim.documents || claim.documents.length === 0 ? (
                              <div className="bg-slate-800/20 border border-dashed border-slate-700/50 rounded-lg py-4 text-center">
                                <p className="text-xs text-slate-500">No documents uploaded yet</p>
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 overflow-hidden">
                                {claim.documents.map((doc: any) => {
                                  const documentRemark = getDocumentRemark(claim, doc);
                                  const rawDocStatus = String(doc.status || "").toLowerCase();
                                  const showDocumentStatus = !(status === "rejected" && rawDocStatus === "rejected" && !documentRemark);
                                  const documentStatus = String(doc.documentStatus || '').toLowerCase();
                                  return (
                                    <div key={doc.documentId} className="px-3 py-2.5 bg-slate-900/50">
                                      <div className="flex flex-wrap items-center justify-between gap-2 min-h-[40px]">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                                          <span className="text-xs font-medium text-slate-200 truncate">{formatDocumentType(doc.documentType)}</span>
                                          {documentStatus && (
                                            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded border capitalize ${getDocumentStatusStyle(documentStatus)}`}>
                                              {documentStatus}
                                            </span>
                                          )}
                                          {showDocumentStatus && (
                                            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded border ${doc.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                              doc.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                                                'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                              }`}>
                                              {doc.status}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            className="px-2.5 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded border border-blue-500/30"
                                            onClick={() => openDocumentViewer(doc.viewUrl, formatDocumentType(doc.documentType))}
                                          >
                                            View
                                          </button>
                                          <input
                                            id={`reupload-${claim.id}-${doc.documentType}`}
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            className="hidden"
                                            onChange={(e) => handleReuploadFileChange(claim.id, doc.documentType, e)}
                                          />
                                          <button
                                            type="button"
                                            className="px-2.5 py-1.5 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={uploadingKey === `${claim.id}:${doc.documentType}` || !isRejectedClaim}
                                            onClick={() => {
                                              const input = document.getElementById(`reupload-${claim.id}-${doc.documentType}`) as HTMLInputElement | null;
                                              input?.click();
                                            }}
                                          >
                                            {uploadingKey === `${claim.id}:${doc.documentType}` ? "Uploading..." : "Reupload"}
                                          </button>
                                        </div>
                                      </div>
                                      {documentRemark && (
                                        <p className="mt-1 text-[11px] text-amber-300">Document note: {documentRemark}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}

              </div>
            )}
          </motion.div>
        )}
      </div>
      <Dialog open={viewerOpen} onOpenChange={(open) => (open ? setViewerOpen(true) : closeDocumentViewer())}>
        <DialogContent className="max-w-6xl w-[99vw] sm:w-[98vw] h-[96vh] sm:h-[95vh] p-0 bg-black/60 backdrop-blur-sm border-none overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl h-full flex flex-col"
          >
            {/* Enhanced Header Bar */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800/80">
              {/* Document Name */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{viewerDocumentName}</h3>
                  <p className="text-xs text-slate-400">Document Preview</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Download Button */}
                <Button
                  onClick={() => {
                    if (viewerUrl) {
                      const link = document.createElement('a');
                      link.href = viewerUrl;
                      link.download = viewerDocumentName;
                      link.target = '_blank';
                      link.click();
                    }
                  }}
                  className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 hover:from-emerald-500/20 hover:to-emerald-600/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-300"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>

                {/* Close Button */}
                <Button
                  onClick={closeDocumentViewer}
                  variant="ghost"
                  className="text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  size="icon"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Document Viewer Container */}
            <div className="flex-1 relative overflow-hidden bg-slate-800/50">
              {/* Zoom Controls - Top Right */}
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setDocumentZoom(Math.min(documentZoom + 25, 200))}
                  className="p-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-all shadow-lg backdrop-blur-sm"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setDocumentZoom(Math.max(documentZoom - 25, 50))}
                  className="p-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-all shadow-lg backdrop-blur-sm"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </motion.button>
                <div className="px-3 py-2.5 bg-slate-900/90 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 backdrop-blur-sm">
                  {documentZoom}%
                </div>
              </div>

              {/* Document Preview - Full Width */}
              <div className="w-full h-full overflow-auto bg-slate-900/50">
                <div
                  className="min-h-full flex items-start justify-center p-5"
                  style={{
                    transform: `scale(${documentZoom / 100})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.3s ease'
                  }}
                >
                  <div className="w-[min(98vw,1120px)] h-[80vh] sm:h-[82vh] bg-white rounded-lg shadow-2xl overflow-hidden">
                    {viewerLoading ? (
                      <div className="w-full h-full flex items-center justify-center bg-white">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3" />
                          <p className="text-slate-600">Loading document...</p>
                        </div>
                      </div>
                    ) : viewerError ? (
                      <div className="w-full h-full flex items-center justify-center bg-white">
                        <div className="text-center">
                          <FileText className="w-16 h-16 text-red-300 mx-auto mb-3" />
                          <p className="text-red-600 font-medium">Preview failed</p>
                          <p className="text-slate-500 text-sm mt-1">{viewerError}</p>
                        </div>
                      </div>
                    ) : viewerUrl ? (
                      <iframe
                        src={viewerUrl}
                        title={viewerDocumentName}
                        className="w-full h-full border-none bg-white"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
                        <div className="text-center">
                          <FileText className="w-16 h-16 text-slate-600 mx-auto mb-3" />
                          <p className="text-slate-400">No document to preview</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
