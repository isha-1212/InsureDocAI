import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLocation } from "wouter";
import { Eye, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface ClaimRequest {
  claim_id: string;
  user_name: string;
  user_email: string;
  policy_number: string;
  status: string;
  risk_level: string;
  created_at: string;
  documents: any[];
  document_count: number;
}

const getRiskLevelBadge = (riskLevel: string) => {
  switch (riskLevel) {
    case "Low":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "Medium":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "High":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }
};

// Animation variants - slide from right with subtle rotation
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: 40, rotateY: -5 },
  visible: {
    opacity: 1,
    x: 0,
    rotateY: 0,
    transition: {
      type: "spring",
      stiffness: 90,
      damping: 18,
      duration: 0.7
    }
  }
};

export default function ClaimProcessing() {
  const [_, setLocation] = useLocation();
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Not authenticated');
      }

      // Fetch claims from backend
      const response = await fetch('/api/admin/claims/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch claims: ${response.status}`);
      }

      const data = await response.json();
      setClaims(data.claims || []);

    } catch (err) {
      console.error('Error fetching claims:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch claims';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleViewClaim = (claimId: string) => {
    setLocation(`/admin/claims/review/${claimId}`);
  };

  const handleRefresh = () => {
    fetchClaims(true);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
          <span className="ml-3 text-lg text-slate-300">Loading claims...</span>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="p-6 space-y-6"
      >
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Claim Processing</h1>
              <p className="text-slate-400 text-lg">Review incoming claim requests from policy holders.</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="mb-4 flex justify-between items-center">
          <p className="text-slate-400">
            {claims.length === 0
              ? "No claims with uploaded documents found."
              : `Found ${claims.length} claim${claims.length === 1 ? '' : 's'} with uploaded documents.`
            }
          </p>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 hover:from-blue-600 hover:via-cyan-600 hover:to-blue-700 text-white font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 active:scale-95 rounded-xl px-5 py-2 border border-blue-400/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl shadow-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 uppercase text-xs tracking-wider">Claim ID</TableHead>
                <TableHead className="text-slate-400 uppercase text-xs tracking-wider">User Name</TableHead>
                <TableHead className="text-slate-400 uppercase text-xs tracking-wider">Policy Number</TableHead>
                <TableHead className="text-slate-400 uppercase text-xs tracking-wider">Documents</TableHead>
                <TableHead className="text-slate-400 uppercase text-xs tracking-wider">Risk Level</TableHead>
                <TableHead className="text-slate-400 uppercase text-xs tracking-wider">Status</TableHead>
                <TableHead className="text-right text-slate-400 uppercase text-xs tracking-wider">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    No claims with uploaded documents found. Users need to submit their documents first.
                  </TableCell>
                </TableRow>
              ) : (
                claims.map((claim) => (
                  <TableRow
                    key={claim.claim_id}
                    className="border-slate-800 hover:bg-slate-800/50 transition-all duration-200 hover:scale-[1.01] cursor-pointer"
                  >
                    <TableCell className="font-mono font-medium text-blue-400">
                      {claim.claim_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-200">{claim.user_name}</div>
                      <div className="text-sm text-slate-400">{claim.user_email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-300">{claim.policy_number}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-blue-400 mb-2">{claim.document_count} uploaded</div>
                      <div className="flex flex-wrap gap-1">
                        {claim.documents.map((doc, idx) => (
                          <span
                            key={idx}
                            className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md text-xs font-medium border border-blue-500/30"
                          >
                            {doc.document_type}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${getRiskLevelBadge(claim.risk_level)}`}
                      >
                        {claim.risk_level}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border
                          ${claim.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : claim.status === 'pending'
                              ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                          }`}
                      >
                        {claim.status === 'pending' ? 'Pending Review' : claim.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleViewClaim(claim.claim_id)}
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View / Process
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </motion.div>
      </motion.div>
    </Layout>
  );
}
