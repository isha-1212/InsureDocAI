import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion, useAnimation } from "framer-motion";
import {
  FileText,
  Users,
  ClipboardCheck,
  TrendingUp,
  Activity,
  Shield,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  Sparkles
} from "lucide-react";

import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

type InsightCard = {
  total_documents_processed: number;
  total_users: number;
  total_claims: number;
};

type TypeMetric = {
  document_type: string;
  label: string;
  count?: number;
  avg_confidence?: number | null;
};

type InsightsPayload = {
  documents_per_day: Array<{ day: string; count: number }>;
  documents_by_type: TypeMetric[];
  document_distribution: TypeMetric[];
  cards: InsightCard;
  avg_confidence_by_type: TypeMetric[];
  cross_document_matching?: {
    matched: number;
    mismatched: number;
    total_compared: number;
    match_rate: number;
    mismatch_rate: number;
    breakdown: Array<{ status: string; count: number }>;
  };
};

type OverviewPayload = {
  insights: InsightsPayload;
};

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api`;
const COLORS = ["#0EA5E9", "#06B6D4", "#3B82F6", "#0284C7", "#0891B2", "#2563EB"];
const GRADIENT_COLORS = [
  "from-blue-500 to-cyan-500",
  "from-cyan-500 to-blue-500",
  "from-blue-600 to-cyan-600",
  "from-cyan-600 to-blue-600",
  "from-blue-400 to-cyan-400",
  "from-cyan-400 to-blue-400"
];

const REQUIRED_TYPES = ["hospital_bill", "pharmacy_bill", "aadhaar", "pan"];

// Animation variants - Enhanced for modern SaaS feel
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
      duration: 0.4,
      ease: "easeOut"
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1] // Custom easing for smooth feel
    }
  }
};

const cardHoverVariants = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.02,
    y: -4,
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  }
};

// Custom tooltip components - Enhanced styling
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/98 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4 shadow-2xl shadow-blue-500/20"
      >
        <p className="font-semibold text-slate-100 mb-1">{`${label}`}</p>
        <p className="text-blue-400 font-medium">
          {`${payload[0].name}: ${payload[0].value}`}
        </p>
      </motion.div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/98 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4 shadow-2xl shadow-blue-500/20"
      >
        <p className="font-semibold text-white mb-1">{label}</p>
        <p className="text-cyan-300 font-semibold text-base">
          Confidence: {(payload[0].value * 100).toFixed(1)}%
        </p>
      </motion.div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${API_BASE}/admin/overview/`, { headers });
      if (!response.ok) throw new Error("Failed to load admin insights");
      const data = (await response.json()) as OverviewPayload;
      setInsights(data.insights);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const cards = insights?.cards || {
    total_documents_processed: 0,
    total_users: 0,
    total_claims: 0,
  };

  const byType = useMemo(() => {
    const source = insights?.documents_by_type || [];
    const map = new Map(source.map((x) => [x.document_type, x]));
    return REQUIRED_TYPES.map((key) => {
      const found = map.get(key);
      return {
        document_type: key,
        label: found?.label || key.replace("_", " ").toUpperCase(),
        count: found?.count || 0,
      };
    });
  }, [insights]);

  const confidenceByType = useMemo(() => {
    const source = insights?.avg_confidence_by_type || [];
    const map = new Map(source.map((x) => [x.document_type, x]));
    return REQUIRED_TYPES.map((key) => {
      const found = map.get(key);
      return {
        document_type: key,
        label: found?.label || key.replace("_", " ").toUpperCase(),
        avg_confidence: Number(found?.avg_confidence || 0),
      };
    });
  }, [insights]);

  const crossDocumentMatching = insights?.cross_document_matching || {
    matched: 0,
    mismatched: 0,
    total_compared: 0,
    match_rate: 0,
    mismatch_rate: 0,
    breakdown: [
      { status: "Matched", count: 0 },
      { status: "Mismatched", count: 0 },
    ],
  };

  return (
    <Layout scrollable={true}>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="flex flex-col space-y-8"
      >
        {/* Header Section - Enhanced */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 shrink-0"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 shadow-lg shadow-blue-500/30 flex items-center justify-center"
              >
                <Sparkles className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent tracking-tight">
                  Admin Overview
                </h1>
              </div>
            </div>
            <p className="text-slate-400 text-base font-medium pl-1">
              Document Processing and ML Performance Dashboard
            </p>
            {lastUpdated && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2 pl-1"
              >
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <p className="text-xs text-slate-500 font-mono">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              </motion.div>
            )}
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 hover:from-blue-600 hover:via-cyan-600 hover:to-blue-700 text-white font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 active:scale-95 rounded-xl px-6 py-2.5 border border-blue-400/20"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </motion.div>
        </motion.div>

        {/* Error State - Enhanced */}
        {error && (
          <motion.div
            variants={itemVariants}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="bg-gradient-to-br from-red-900/30 via-red-800/20 to-red-900/30 border border-red-500/40 backdrop-blur-xl shadow-2xl shadow-red-500/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-red-300 text-lg mb-1">Error Loading Dashboard</h3>
                    <p className="text-red-400/90 text-sm">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Loading Skeletons - Enhanced */}
        {loading && (
          <motion.div variants={itemVariants} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/50 backdrop-blur-xl shadow-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-3 flex-1">
                      <Skeleton className="h-3 w-32 bg-slate-700/50 rounded-full" />
                      <Skeleton className="h-10 w-20 bg-slate-700/50 rounded-lg" />
                      <Skeleton className="h-5 w-24 bg-slate-700/50 rounded-full" />
                    </div>
                    <Skeleton className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-700/50 to-slate-600/50" />
                  </div>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/50 backdrop-blur-xl shadow-2xl p-6">
                  <Skeleton className="h-6 w-48 mb-6 bg-slate-700/50 rounded-lg" />
                  <Skeleton className="h-64 w-full bg-slate-700/30 rounded-xl" />
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* Main Dashboard Content */}
        {!loading && !error && insights && (
          <>
            {/* Stats Cards - Completely Redesigned */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Documents Processed */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
                whileHover="hover"
                variants={cardHoverVariants}
              >
                <Card className="group relative bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 border border-slate-700/60 backdrop-blur-2xl shadow-2xl shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 overflow-hidden">
                  {/* Animated gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Subtle pattern overlay */}
                  <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
                    <CardTitle className="text-sm font-semibold text-slate-400 group-hover:text-slate-300 transition-colors tracking-wide uppercase">
                      Documents Processed
                    </CardTitle>
                    <motion.div
                      className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-shadow"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FileText className="w-5 h-5 text-white" />
                    </motion.div>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-3">
                    <motion.div
                      className="text-5xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3, type: "spring" }}
                    >
                      {cards.total_documents_processed.toLocaleString()}
                    </motion.div>
                    <div className="flex items-center gap-2.5">
                      <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-3 py-1 rounded-full font-semibold hover:bg-blue-500/30 transition-colors">
                        +12.5%
                      </Badge>
                      <span className="text-xs text-slate-500 font-medium">vs last month</span>
                    </div>
                    <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                      <span>Trending upward</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Card 2: Total Users */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
                whileHover="hover"
                variants={cardHoverVariants}
              >
                <Card className="group relative bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 border border-slate-700/60 backdrop-blur-2xl shadow-2xl shadow-cyan-500/10 hover:shadow-cyan-500/20 transition-all duration-300 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
                    <CardTitle className="text-sm font-semibold text-slate-400 group-hover:text-slate-300 transition-colors tracking-wide uppercase">
                      Total Users
                    </CardTitle>
                    <motion.div
                      className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-500/50 transition-shadow"
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Users className="w-5 h-5 text-white" />
                    </motion.div>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-3">
                    <motion.div
                      className="text-5xl font-bold bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-transparent"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.4, type: "spring" }}
                    >
                      {cards.total_users.toLocaleString()}
                    </motion.div>
                    <div className="flex items-center gap-2.5">
                      <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-3 py-1 rounded-full font-semibold hover:bg-cyan-500/30 transition-colors">
                        +8.2%
                      </Badge>
                      <span className="text-xs text-slate-500 font-medium">vs last month</span>
                    </div>
                    <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Active growth</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Card 3: Total Claims */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
                whileHover="hover"
                variants={cardHoverVariants}
              >
                <Card className="group relative bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 border border-slate-700/60 backdrop-blur-2xl shadow-2xl shadow-blue-600/10 hover:shadow-blue-600/20 transition-all duration-300 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-cyan-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
                    <CardTitle className="text-sm font-semibold text-slate-400 group-hover:text-slate-300 transition-colors tracking-wide uppercase">
                      Total Claims
                    </CardTitle>
                    <motion.div
                      className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg shadow-blue-600/30 group-hover:shadow-blue-600/50 transition-shadow"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ClipboardCheck className="w-5 h-5 text-white" />
                    </motion.div>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-3">
                    <motion.div
                      className="text-5xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.5, type: "spring" }}
                    >
                      {cards.total_claims.toLocaleString()}
                    </motion.div>
                    <div className="flex items-center gap-2.5">
                      <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-3 py-1 rounded-full font-semibold hover:bg-cyan-500/30 transition-colors">
                        +15.3%
                      </Badge>
                      <span className="text-xs text-slate-500 font-medium">vs last month</span>
                    </div>
                    <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <Target className="w-3.5 h-3.5 text-blue-400" />
                      <span>On target</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* Charts Grid - Modernized */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Documents Per Day Chart - Enhanced */}
              <motion.div variants={itemVariants} whileHover="hover" className="h-full">
                <motion.div variants={cardHoverVariants} className="h-full">
                  <Card className="group h-full flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 border border-slate-700/60 backdrop-blur-2xl shadow-2xl shadow-blue-500/10 hover:shadow-blue-500/15 transition-all duration-500 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

                    <CardHeader className="pb-4 relative z-10 shrink-0">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="p-2.5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg shadow-blue-500/30"
                          whileHover={{ scale: 1.1, rotate: 10 }}
                        >
                          <TrendingUp className="h-5 w-5 text-white" />
                        </motion.div>
                        <CardTitle className="text-xl font-bold text-white group-hover:text-blue-100 transition-colors">
                          Documents Per Day
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10 flex-1 flex items-center justify-center pb-6">
                      <div className="h-64 w-full -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={insights?.documents_per_day || []}>
                            <defs>
                              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                            <XAxis
                              dataKey="day"
                              tick={{ fontSize: 12, fill: '#94a3b8' }}
                              stroke="#475569"
                              strokeWidth={0.5}
                            />
                            <YAxis
                              allowDecimals={false}
                              tick={{ fontSize: 12, fill: '#94a3b8' }}
                              stroke="#475569"
                              strokeWidth={0.5}
                            />
                            <Tooltip
                              content={<CustomTooltip />}
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #1e293b',
                                borderRadius: '12px',
                                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
                              }}
                              cursor={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="count"
                              stroke="#0EA5E9"
                              strokeWidth={3}
                              dot={{ r: 5, fill: '#0EA5E9', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{
                                r: 8,
                                fill: '#38bdf8',
                                strokeWidth: 3,
                                stroke: '#fff',
                                filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.4))'
                              }}
                              fill="url(#colorGradient)"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              {/* Distribution By Type - Enhanced */}
              <motion.div variants={itemVariants} whileHover="hover" className="h-full">
                <motion.div variants={cardHoverVariants} className="h-full">
                  <Card className="group h-full flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 border border-slate-700/60 backdrop-blur-2xl shadow-2xl shadow-cyan-500/10 hover:shadow-cyan-500/15 transition-all duration-500 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

                    <CardHeader className="pb-4 relative z-10 shrink-0">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl shadow-lg shadow-cyan-500/30"
                          whileHover={{ scale: 1.1, rotate: -10 }}
                        >
                          <PieChartIcon className="h-5 w-5 text-white" />
                        </motion.div>
                        <CardTitle className="text-xl font-bold text-white group-hover:text-cyan-100 transition-colors">
                          Distribution By Type
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10 flex-1 flex items-center justify-center pb-6">
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={byType}
                              dataKey="count"
                              nameKey="label"
                              outerRadius={85}
                              innerRadius={45}
                              paddingAngle={3}
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                              style={{ fontSize: '13px', fill: '#e2e8f0', fontWeight: 600 }}
                              activeShape={{
                                stroke: '#38bdf8',
                                strokeWidth: 4,
                                filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.4))'
                              }}
                            >
                              {byType.map((entry, index) => (
                                <Cell
                                  key={`${entry.document_type}-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                  stroke="#0f172a"
                                  strokeWidth={3}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              content={<CustomTooltip />}
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #1e293b',
                                borderRadius: '12px',
                                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
                              }}
                              cursor={false}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              {/* ML Confidence Chart - Enhanced */}
              <motion.div variants={itemVariants} whileHover="hover" className="h-full">
                <motion.div variants={cardHoverVariants} className="h-full">
                  <Card className="group h-full flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 border border-slate-700/60 backdrop-blur-2xl shadow-2xl shadow-blue-600/10 hover:shadow-blue-600/15 transition-all duration-500 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

                    <CardHeader className="pb-4 relative z-10 shrink-0">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="p-2.5 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl shadow-lg shadow-blue-600/30"
                          whileHover={{ scale: 1.1, rotate: 10 }}
                        >
                          <BarChart3 className="h-5 w-5 text-white" />
                        </motion.div>
                        <CardTitle className="text-xl font-bold text-white group-hover:text-blue-100 transition-colors">
                          ML Confidence By Type
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10 flex-1 flex items-center justify-center pb-6">
                      <div className="h-64 w-full -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={confidenceByType}>
                            <defs>
                              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0EA5E9" stopOpacity={1} />
                                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 12, fill: '#94a3b8' }}
                              stroke="#475569"
                              strokeWidth={0.5}
                            />
                            <YAxis
                              domain={[0, 1]}
                              tick={{ fontSize: 12, fill: '#94a3b8' }}
                              stroke="#475569"
                              strokeWidth={0.5}
                            />
                            <Tooltip
                              content={<CustomBarTooltip />}
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #1e293b',
                                borderRadius: '12px',
                                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
                              }}
                              cursor={false}
                            />
                            <Bar
                              dataKey="avg_confidence"
                              fill="url(#barGradient)"
                              radius={[10, 10, 0, 0]}
                              stroke="#0EA5E9"
                              strokeWidth={0}
                              activeBar={{
                                fill: '#38bdf8',
                                stroke: '#0ea5e9',
                                strokeWidth: 2,
                                filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.4))'
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              {/* Cross-Document Matching - Enhanced */}
              <motion.div variants={itemVariants} whileHover="hover" className="h-full">
                <motion.div variants={cardHoverVariants} className="h-full">
                  <Card className="group h-full flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 border border-slate-700/60 backdrop-blur-2xl shadow-2xl shadow-cyan-600/10 hover:shadow-cyan-600/15 transition-all duration-500 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

                    <CardHeader className="pb-4 relative z-10 shrink-0">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="p-2.5 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl shadow-lg shadow-cyan-600/30"
                          whileHover={{ scale: 1.1, rotate: -10 }}
                        >
                          <Target className="h-5 w-5 text-white" />
                        </motion.div>
                        <CardTitle className="text-xl font-bold text-white group-hover:text-cyan-100 transition-colors">
                          Cross-Document Matching
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10 flex-1 flex flex-col justify-between pb-6">
                      <div className="flex-1 flex items-center justify-center mb-4">
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={crossDocumentMatching.breakdown}
                                dataKey="count"
                                nameKey="status"
                                innerRadius={50}
                                outerRadius={75}
                                paddingAngle={4}
                                stroke="#0f172a"
                                strokeWidth={3}
                                activeShape={{
                                  stroke: '#38bdf8',
                                  strokeWidth: 4,
                                  filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.4))'
                                }}
                              >
                                <Cell fill="#06B6D4" />
                                <Cell fill="#F43F5E" />
                              </Pie>
                              <Tooltip
                                content={<CustomTooltip />}
                                contentStyle={{
                                  backgroundColor: '#0f172a',
                                  border: '1px solid #1e293b',
                                  borderRadius: '12px',
                                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
                                }}
                                cursor={false}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 shrink-0">
                        <motion.div
                          className="rounded-2xl bg-gradient-to-br from-cyan-900/50 to-blue-900/50 p-5 text-center border border-cyan-500/30 backdrop-blur-sm shadow-lg shadow-cyan-500/10"
                          whileHover={{ scale: 1.02 }}
                        >
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-3 h-3 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50"></div>
                            <span className="text-sm font-bold text-cyan-200 uppercase tracking-wide">Matched</span>
                          </div>
                          <p className="text-3xl font-bold text-white mb-2">{crossDocumentMatching.match_rate}%</p>
                          <Badge className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold">
                            {crossDocumentMatching.matched} docs
                          </Badge>
                        </motion.div>
                        <motion.div
                          className="rounded-2xl bg-gradient-to-br from-rose-900/50 to-red-900/50 p-5 text-center border border-rose-500/30 backdrop-blur-sm shadow-lg shadow-rose-500/10"
                          whileHover={{ scale: 1.02 }}
                        >
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-3 h-3 bg-rose-400 rounded-full shadow-lg shadow-rose-400/50"></div>
                            <span className="text-sm font-bold text-rose-200 uppercase tracking-wide">Mismatched</span>
                          </div>
                          <p className="text-3xl font-bold text-white mb-2">{crossDocumentMatching.mismatch_rate}%</p>
                          <Badge className="text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold">
                            {crossDocumentMatching.mismatched} docs
                          </Badge>
                        </motion.div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </div>
          </>
        )}
      </motion.div>
    </Layout>
  );
}
