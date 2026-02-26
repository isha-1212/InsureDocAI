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
import { FileText, Plus, ShieldAlert, Clock, AlertTriangle, Upload, X, Users, TrendingUp, CheckCircle, XCircle, IndianRupee, Calendar, ZoomIn, ZoomOut, Download } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const policyUploadSchema = z.object({
  policy_number: z.string().min(1, "Policy number is required"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
});

export default function UserDashboard() {
  const [location] = useLocation();
  const { userId } = useAuth();
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    resolver: zodResolver(policyUploadSchema),
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

  const isPending = policy?.status === "pending";
  const isRejected = policy?.status === "rejected";

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

  const onSubmit = async (data: z.infer<typeof policyUploadSchema>) => {
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
        throw new Error(error.error || error.message || "Upload failed");
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
                          <Input placeholder="POL-123456789" {...field} />
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
                    <FormLabel className="text-slate-300">Policy Document (PDF/Image)</FormLabel>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
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
                          <p className="text-xs text-slate-500 mt-1">PDF, JPG, PNG (max 5MB)</p>
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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              {isMyClaimsPage ? "My Claims" : "Dashboard"}
            </h1>
            <p className="text-slate-400 mt-2">
              {isMyClaimsPage ? "Track claim status and document updates." : "Manage your health insurance and claims."}
            </p>
          </div>
        </motion.div>

        {!isMyClaimsPage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-slate-900/60 backdrop-blur border border-slate-800 overflow-hidden relative group hover:border-slate-700/50 hover:shadow-xl transition-all duration-300">
              <div className={`absolute top-0 left-0 w-1 h-full ${isPending ? "bg-amber-500" : isRejected ? "bg-rose-500" : "bg-emerald-500"}`} />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="pb-4 relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl text-white">Policy #{policy.policyNumber}</CardTitle>
                    <CardDescription className="mt-1 text-slate-400">Valid: {policy.startDate} to {policy.endDate}</CardDescription>
                  </div>
                  <StatusBadge status={policy.status} className="text-sm px-3 py-1" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                {isPending && (
                  <div className="bg-gradient-to-r from-amber-900/40 to-amber-800/40 text-amber-200 p-4 rounded-lg flex items-start gap-3 border border-amber-500/30 backdrop-blur-sm">
                    <Clock className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-400" />
                    <p className="text-sm">Your policy is currently under review by our administrators. Claim submission and family member management will be enabled once approved.</p>
                  </div>
                )}
                {isRejected && (
                  <div className="bg-gradient-to-r from-rose-900/40 to-rose-800/40 text-rose-200 p-4 rounded-lg flex items-start gap-3 border border-rose-500/30 backdrop-blur-sm">
                    <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-rose-400" />
                    <div>
                      <p className="font-semibold text-sm text-rose-300">Policy Rejected</p>
                      <p className="text-sm mt-1">{policy.rejectionReason || "Please contact support for details."}</p>
                    </div>
                  </div>
                )}
                {!isPending && !isRejected && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mt-2">
                    <motion.div
                      whileHover={{ scale: 1.05, y: -2 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-xl border border-blue-500/30 backdrop-blur-sm hover:border-blue-400/50 hover:shadow-xl transition-all duration-300 group shadow-lg hover:shadow-blue-500/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-blue-300 uppercase tracking-wider font-semibold">Members</p>
                        <Users className="w-4 h-4 text-blue-400" />
                      </div>
                      <p className="text-3xl font-bold text-white group-hover:text-blue-300 transition-colors">{policy.members?.length || 0}</p>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05, y: -2 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-xl border border-purple-500/30 backdrop-blur-sm hover:border-purple-400/50 hover:shadow-xl transition-all duration-300 group shadow-lg hover:shadow-purple-500/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold">Total Claims</p>
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                      </div>
                      <p className="text-3xl font-bold text-white group-hover:text-purple-300 transition-colors">{totalClaims}</p>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05, y: -2 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/10 rounded-xl border border-amber-500/30 backdrop-blur-sm hover:border-amber-400/50 hover:shadow-xl transition-all duration-300 group shadow-lg hover:shadow-amber-500/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-amber-300 uppercase tracking-wider font-semibold">Pending</p>
                        <Clock className="w-4 h-4 text-amber-400" />
                      </div>
                      <p className="text-3xl font-bold text-white group-hover:text-amber-300 transition-colors">{totalPendingClaims}</p>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05, y: -2 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 rounded-xl border border-emerald-500/30 backdrop-blur-sm hover:border-emerald-400/50 hover:shadow-xl transition-all duration-300 group shadow-lg hover:shadow-emerald-500/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-emerald-300 uppercase tracking-wider font-semibold">Approved</p>
                        <IndianRupee className="w-4 h-4 text-emerald-400" />
                      </div>
                      <p className="text-3xl font-bold text-white group-hover:text-emerald-300 transition-colors">₹{totalApprovedAmount.toFixed(0)}</p>
                    </motion.div>
                    <div className="flex items-center">
                      <Link href="/portal/claims/new" className="w-full">
                        <Button className="w-full h-full min-h-[88px] sm:min-h-[100px] text-base font-semibold bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 hover:from-purple-600 hover:via-pink-600 hover:to-blue-600 text-white shadow-xl shadow-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 active:scale-95 rounded-xl border border-purple-400/20">
                          <div className="flex flex-col items-center gap-2">
                            <Plus className="w-6 h-6" />
                            <span>New Claim</span>
                          </div>
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!isMyClaimsPage ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Recent Claims</h2>
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
            ) : recentClaims.length === 0 ? (
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
                  <Link href="/portal/new-claim">
                    <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium px-5 py-2 rounded-lg shadow-lg hover:shadow-blue-500/50 transition-all duration-300">
                      <Plus className="w-4 h-4 mr-2" />
                      Submit New Claim
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ) : (
              <div className="grid gap-4">
                {recentClaims.map((claim, index) => {
                  const status = String(claim.status || "").toLowerCase();
                  const statusColors = {
                    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                    pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
                    rejected: "bg-red-500/10 text-red-400 border-red-500/30",
                    default: "bg-slate-500/10 text-slate-400 border-slate-500/30"
                  };
                  const statusColor = statusColors[status as keyof typeof statusColors] || statusColors.default;
                  const StatusIcon = status === 'approved' ? CheckCircle : status === 'rejected' ? XCircle : Clock;

                  return (
                    <Link href="/portal/claims" key={claim.id} className="block">
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ scale: 1.02, x: 4 }}
                        transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 25 }}
                        className="bg-gradient-to-br from-slate-900/90 to-slate-900/50 p-5 rounded-xl border border-slate-800/50 hover:border-slate-700/80 hover:bg-slate-800/50 transition-all duration-300 backdrop-blur-sm group overflow-hidden relative cursor-pointer shadow-lg hover:shadow-xl"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30 group-hover:scale-110 transition-transform">
                              ₹
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-white text-base sm:text-lg">Claim #{claim.id}</p>
                                <span className={`text-xs px-2.5 py-1 rounded-full border ${statusColor} font-medium uppercase tracking-wide flex items-center gap-1`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {status}
                                </span>
                              </div>
                              <p className="text-sm text-slate-400 flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" />
                                {claim.member?.name || "Policy holder"}
                              </p>
                              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <Calendar className="w-3 h-3" />
                                {claim.submittedDate ? format(new Date(claim.submittedDate), "MMM dd, yyyy") : "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-bold text-xl sm:text-2xl text-white group-hover:text-blue-300 transition-colors">₹{claim.totalAmount || 0}</p>
                            <p className="text-xs text-slate-500 mt-1">Amount</p>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  );
                })}
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
                  <Link href="/portal/new-claim">
                    <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium px-8 py-3 rounded-xl shadow-lg hover:shadow-blue-500/50 transition-all duration-300">
                      <Plus className="w-5 h-5 mr-2" />
                      Submit First Claim
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {allClaims.map((claim, index) => {
                  const status = String(claim.status || "").toLowerCase();
                  const statusColors = {
                    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                    pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
                    rejected: "bg-red-500/10 text-red-400 border-red-500/30",
                    default: "bg-slate-500/10 text-slate-400 border-slate-500/30"
                  };
                  const statusColor = statusColors[status as keyof typeof statusColors] || statusColors.default;
                  const StatusIcon = status === 'approved' ? CheckCircle : status === 'rejected' ? XCircle : Clock;

                  return (
                    <motion.div
                      key={claim.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.01, y: -2 }}
                      transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 25 }}
                      className="bg-gradient-to-br from-slate-900/90 to-slate-900/50 rounded-xl border border-slate-800/50 p-6 backdrop-blur-sm hover:border-slate-700/80 transition-all duration-300 shadow-lg hover:shadow-xl group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      {/* Header Section */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30 text-xl group-hover:scale-110 transition-transform">
                            ₹
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-white text-lg sm:text-xl">Claim #{claim.id}</p>
                              <span className={`text-xs px-2.5 py-1 rounded-full border ${statusColor} font-medium uppercase tracking-wide flex items-center gap-1`}>
                                <StatusIcon className="w-3 h-3" />
                                {status}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400 flex items-center gap-2">
                              <Users className="w-3.5 h-3.5" />
                              For: {claim.member?.name || "Policy holder"}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-slate-500 mb-1">Claim Amount</p>
                          <p className="font-bold text-2xl sm:text-3xl text-white group-hover:text-blue-300 transition-colors">
                            ₹{claim.totalAmount && claim.totalAmount > 0 ? claim.totalAmount : "0"}
                          </p>
                        </div>
                      </div>

                      {/* Documents Section */}
                      <div className="border-t border-slate-700/50 pt-4 relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <p className="text-sm font-semibold text-white">Documents</p>
                        </div>
                        {!claim.documents || claim.documents.length === 0 ? (
                          <div className="bg-slate-800/20 border border-dashed border-slate-700/50 rounded-lg py-6 text-center">
                            <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">No documents uploaded yet</p>
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            {claim.documents.map((doc: any) => (
                              <motion.div
                                key={doc.documentId}
                                whileHover={{ scale: 1.02, x: 4 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 rounded-lg px-4 py-3.5 border border-slate-700/50 hover:border-slate-600/70 hover:shadow-lg transition-all group"
                              >
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                      <FileText className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                        <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs font-semibold rounded border border-blue-500/30">
                                          {formatDocumentType(doc.documentType)}
                                        </span>
                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded border ${doc.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                          doc.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                                            'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                          }`}>
                                          {doc.status}
                                        </span>
                                      </div>
                                      {doc.remarks && (
                                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">Remarks: {doc.remarks}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 lg:ml-4">
                                    <button
                                      type="button"
                                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-500/10 to-blue-600/10 hover:from-blue-500/20 hover:to-blue-600/20 text-blue-400 hover:text-blue-300 text-sm font-medium rounded-lg border border-blue-500/30 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300"
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
                                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-purple-500/10 to-purple-600/10 hover:from-purple-500/20 hover:to-purple-600/20 text-purple-400 hover:text-purple-300 text-sm font-medium rounded-lg border border-purple-500/30 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                                      disabled={uploadingKey === `${claim.id}:${doc.documentType}`}
                                      onClick={() => {
                                        const input = document.getElementById(`reupload-${claim.id}-${doc.documentType}`) as HTMLInputElement | null;
                                        input?.click();
                                      }}
                                    >
                                      {uploadingKey === `${claim.id}:${doc.documentType}` ? "Uploading..." : "Reupload"}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
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
