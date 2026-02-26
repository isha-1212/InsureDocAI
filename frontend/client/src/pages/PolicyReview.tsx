import { Layout } from "@/components/Layout";
import { usePolicies } from "@/hooks/use-policies";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye } from "lucide-react";
import { Link } from "wouter";
import { format, isToday, isYesterday } from "date-fns";
import { motion } from "framer-motion";

// Animation variants - slide in from left
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
};

export default function PolicyReview() {
  const { data: policies, isLoading } = usePolicies(); // Fetch all for admin

  if (isLoading) return <Layout><div className="pt-20 text-center text-slate-400">Loading policies...</div></Layout>;

  return (
    <Layout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="p-6 space-y-6"
      >
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-4xl font-display font-bold text-white mb-2">Policy Review</h1>
          <p className="text-slate-400 text-lg">AI-assisted verification of user policies.</p>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl shadow-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 uppercase text-xs tracking-wider">Request ID</TableHead>
                <TableHead className="text-slate-400 uppercase text-xs tracking-wider">Email</TableHead>
                <TableHead className="text-slate-400 uppercase text-xs tracking-wider">Policy Number (last 4)</TableHead>
                <TableHead className="text-slate-400 uppercase text-xs tracking-wider">Upload Date</TableHead>
                <TableHead className="text-slate-400 uppercase text-xs tracking-wider">Status</TableHead>
                <TableHead className="text-right text-slate-400 uppercase text-xs tracking-wider">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies?.map((policy: any) => (
                <TableRow
                  key={policy.id}
                  className="border-slate-800 hover:bg-slate-800/50 transition-all duration-200 hover:scale-[1.01] cursor-pointer"
                >
                  <TableCell className="font-mono text-xs text-blue-400">{policy.id}</TableCell>
                  <TableCell className="font-medium text-slate-200">{policy.user_email}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    ****{String(policy.policy_number).slice(-4)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {(() => {
                      try {
                        const d = new Date(policy.created_at);
                        if (isNaN(d.getTime())) return policy.created_at;

                        const timePart = format(d, "h:mm a");
                        if (isToday(d)) return `Today, ${timePart}`;
                        if (isYesterday(d)) return `Yesterday, ${timePart}`;

                        return format(d, "dd MMM, h:mm a");
                      } catch {
                        return policy.created_at;
                      }
                    })()}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border
                      ${policy.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : policy.status === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}>
                      {policy.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/policies/${policy.id}`}>
                      <Button
                        asChild
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50"
                      >
                        <span>
                          <Eye className="w-3 h-3 mr-2" /> Review
                        </span>
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      </motion.div>
    </Layout>
  );
}
