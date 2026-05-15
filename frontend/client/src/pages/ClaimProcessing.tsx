import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Hourglass, RefreshCw, XCircle, AlertCircle, Clock, ChevronDown, Copy, Check } from "lucide-react";

import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ClaimListItem = {
  claim_id: string;
  user_name: string;
  user_email: string;
  policy_number: string;
  status: string;
  created_at: string;
  updated_at?: string;
  document_count: number;
  is_reapplied: boolean;
  is_new_claim: boolean;
  rejection_reason?: string | null;
};

type ClaimsResponse = {
  pending_claims: ClaimListItem[];
  approved_claims: ClaimListItem[];
  rejected_claims: ClaimListItem[];
  counts: {
    pending: number;
    approved: number;
    rejected: number;
  };
};

type SortField = "date" | "name" | "id";
type SortOrder = "asc" | "desc";

// Helper: Get priority indicator for attention-grabbing claims
const getPriorityIndicator = (claim: ClaimListItem): { label: string; color: string; icon: React.ReactNode } | null => {
  if (claim.is_reapplied) {
    return {
      label: "Reapplied",
      color: "text-orange-400",
      icon: <RefreshCw className="h-4 w-4" />,
    };
  }
  
  if (claim.is_new_claim) {
    return {
      label: "New Submission",
      color: "text-blue-400",
      icon: <AlertCircle className="h-4 w-4" />,
    };
  }

  // Check if recently submitted (within 1 day)
  const hoursAgo = (new Date().getTime() - new Date(claim.created_at).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 24) {
    return {
      label: "Recently Submitted",
      color: "text-emerald-400",
      icon: <Clock className="h-4 w-4" />,
    };
  }

  return null;
};

// Tooltip component for claim ID
function ClaimIDTooltip({ claimId }: { claimId: string }) {
  const [showFullId, setShowFullId] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(claimId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={showFullId} onOpenChange={setShowFullId}>
      <div
        className="font-medium text-blue-400 cursor-help hover:text-blue-300 transition"
        onClick={() => setShowFullId(true)}
        title="Click to see full claim ID"
      >
        {claimId.slice(0, 12)}...
      </div>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-white">Claim ID</DialogTitle>
          <DialogDescription className="text-slate-400">
            Full claim identifier
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-4">
          <code className="flex-1 font-mono text-sm text-blue-300 break-all">{claimId}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="text-slate-400 hover:text-slate-200 transition"
            title="Copy to clipboard"
          >
            {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) : "-";

function ClaimSection({
  title,
  claims,
  emptyText,
  onOpen,
  showRejectedDetails = false,
  sectionType = "pending",
}: {
  title: string;
  claims: ClaimListItem[];
  emptyText: string;
  onOpen: (claimId: string) => void;
  showRejectedDetails?: boolean;
  sectionType?: "pending" | "approved" | "rejected";
}) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter and sort claims
  const filteredAndSortedClaims = claims
    .filter((claim) =>
      claim.claim_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.policy_number.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any = a[sortField === "date" ? "created_at" : sortField === "name" ? "user_name" : "claim_id"];
      let bValue: any = b[sortField === "date" ? "created_at" : sortField === "name" ? "user_name" : "claim_id"];

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  return (
    <Card className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <span>{title}</span>
              <span className="text-sm font-normal bg-slate-800 px-3 py-1 rounded-full text-slate-300">
                {filteredAndSortedClaims.length} of {claims.length}
              </span>
            </CardTitle>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Search claims, users, policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
            />
            <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
              <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-slate-200">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="date" className="text-slate-200">Sort by Date</SelectItem>
                <SelectItem value="name" className="text-slate-200">Sort by Name</SelectItem>
                <SelectItem value="id" className="text-slate-200">Sort by ID</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 hover:border-slate-600 transition text-sm"
              title={`Sort ${sortOrder === "asc" ? "descending" : "ascending"}`}
            >
              <ChevronDown className={`h-4 w-4 transition ${sortOrder === "desc" ? "" : "rotate-180"}`} />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredAndSortedClaims.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-slate-400">
            {searchQuery ? "No claims match your search." : emptyText}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Claim ID</TableHead>
                  <TableHead className="text-slate-400">User</TableHead>
                  <TableHead className="text-slate-400">Policy ID</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Documents</TableHead>
                  <TableHead className="text-slate-400">
                    {showRejectedDetails ? "Rejected Date" : "Submitted Date"}
                  </TableHead>
                  <TableHead className="text-slate-400">Priority</TableHead>
                  <TableHead className="text-right text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedClaims.map((claim) => {
                  const priority = getPriorityIndicator(claim);
                  return (
                    <TableRow 
                      key={claim.claim_id} 
                      className={`border-slate-800 hover:bg-slate-800/60 transition ${
                        priority ? "bg-slate-900/80" : ""
                      }`}
                    >
                      <TableCell className="font-medium">
                        <ClaimIDTooltip claimId={claim.claim_id} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-200">{claim.user_name}</div>
                        <div className="text-xs text-slate-500">{claim.user_email}</div>
                      </TableCell>
                      <TableCell className="text-slate-300 font-mono text-sm">{claim.policy_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <StatusBadge status={claim.status} />
                          {claim.status === "pending" && claim.is_reapplied && (
                            <span className="inline-block px-2 py-1 text-xs font-semibold rounded border border-orange-500/30 bg-orange-500/10 text-orange-300">
                              Resubmitted
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-blue-400 hover:text-blue-300 transition text-sm font-medium"
                        >
                          {claim.document_count}
                        </button>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {formatDate(showRejectedDetails ? claim.updated_at : claim.created_at)}
                      </TableCell>
                      <TableCell>
                        {priority ? (
                          <div className={`flex items-center gap-1 ${priority.color} text-sm font-medium`}>
                            {priority.icon}
                            <span className="hidden sm:inline">{priority.label}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            onClick={() => onOpen(claim.claim_id)}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-sm h-8"
                          >
                            Details
                          </Button>
                          {showRejectedDetails && claim.rejection_reason && (
                            <div className="text-xs text-rose-300 max-w-xs px-2 py-1 bg-rose-500/10 border border-rose-500/20 rounded rounded-md">
                              {claim.rejection_reason}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClaimProcessing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSection, setSelectedSection] = useState<"pending" | "approved" | "rejected">("pending");
  const [data, setData] = useState<ClaimsResponse>({
    pending_claims: [],
    approved_claims: [],
    rejected_claims: [],
    counts: { pending: 0, approved: 0, rejected: 0 },
  });

  const fetchClaims = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch("/api/admin/claims/", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail || `Failed to fetch claims (${response.status})`);
      }

      setData(payload);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to fetch claims",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center text-slate-300">
          <RefreshCw className="mr-3 h-8 w-8 animate-spin text-blue-400" />
          Loading claims...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white">Claim Workflow</h1>
            <p className="text-slate-400">
              Pending includes new claims and reapplied claims.
            </p>
          </div>
          <Button
            onClick={() => fetchClaims(true)}
            disabled={refreshing}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setSelectedSection("pending")}
            className={`rounded-xl border px-5 py-4 text-left transition ${
              selectedSection === "pending"
                ? "border-blue-500 bg-slate-900/90 shadow-lg shadow-blue-500/10"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <Hourglass className="h-6 w-6 text-amber-400" />
              <span className="text-xl font-bold text-white">{data.counts.pending}</span>
            </div>
            <p className="text-base font-semibold text-white">Pending Claims</p>
            <p className="mt-1 text-sm text-slate-400">New and reapplied claims.</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSection("approved")}
            className={`rounded-xl border px-5 py-4 text-left transition ${
              selectedSection === "approved"
                ? "border-blue-500 bg-slate-900/90 shadow-lg shadow-blue-500/10"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <span className="text-xl font-bold text-white">{data.counts.approved}</span>
            </div>
            <p className="text-base font-semibold text-white">Approved Claims</p>
            <p className="mt-1 text-sm text-slate-400">Claims cleared by admin.</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSection("rejected")}
            className={`rounded-xl border px-5 py-4 text-left transition ${
              selectedSection === "rejected"
                ? "border-blue-500 bg-slate-900/90 shadow-lg shadow-blue-500/10"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <XCircle className="h-6 w-6 text-rose-400" />
              <span className="text-xl font-bold text-white">{data.counts.rejected}</span>
            </div>
            <p className="text-base font-semibold text-white">Rejected Claims</p>
            <p className="mt-1 text-sm text-slate-400">History with reason and date.</p>
          </button>
        </div>

        {selectedSection === "pending" && (
          <ClaimSection
            title="Pending Claims (New & Resubmitted)"
            claims={data.pending_claims}
            emptyText="No pending claims."
            onOpen={(claimId) => setLocation(`/admin/claims/review/${claimId}`)}
            sectionType="pending"
          />
        )}

        {selectedSection === "approved" && (
          <ClaimSection
            title="Approved Claims"
            claims={data.approved_claims}
            emptyText="No approved claims."
            onOpen={(claimId) => setLocation(`/admin/claims/review/${claimId}`)}
            sectionType="approved"
          />
        )}

        {selectedSection === "rejected" && (
          <ClaimSection
            title="Rejected Claims (History)"
            claims={data.rejected_claims}
            emptyText="No rejected claims."
            onOpen={(claimId) => setLocation(`/admin/claims/review/${claimId}`)}
            showRejectedDetails={true}
            sectionType="rejected"
          />
        )}
      </div>
    </Layout>
  );
}
