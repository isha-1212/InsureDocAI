import { Link, useLocation } from "wouter";
import { motion } from 'framer-motion';
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Users,
  Activity,
  ShieldCheck,
  LogOut,
  PlusCircle,
  X
} from "lucide-react";
import { useAuth } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const [location] = useLocation();
  const { role, logout, name, email } = useAuth();
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const isAdmin = role === 'admin';

  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);

    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      const metaName =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        null;
      if (mounted) {
        setSessionName(metaName);
        setSessionEmail(user?.email || null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const resolvedName = name || sessionName;
  const resolvedEmail = email || sessionEmail;
  const displayName = resolvedName || (resolvedEmail ? resolvedEmail.split('@')[0] : (isAdmin ? 'Admin' : 'User'));
  const subtitle = resolvedEmail || (isAdmin ? 'Administrator' : 'Policy Holder');
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || (isAdmin ? 'AD' : 'US');

  const userLinks = [
    { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
    { href: "/portal/members", label: "Family Members", icon: Users },
    { href: "/portal/claims/new", label: "New Claim", icon: PlusCircle },
    { href: "/portal/claims", label: "My Claims", icon: Activity },
  ];

  const adminLinks = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/policies", label: "Policy Review", icon: ShieldCheck },
    { href: "/admin/claims", label: "Claim Processing", icon: FileText },
  ];

  const links = isAdmin ? adminLinks : userLinks;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: isDesktop ? 0 : (isOpen ? 0 : '-100%'),
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed left-0 top-0 h-full bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-900/90",
          "border-r border-slate-800/50 backdrop-blur-xl z-50",
          "w-64 lg:w-72 flex flex-col",
          "lg:static"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800/50">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                MediClaim
              </h1>
              <p className="text-xs text-slate-400">AI Powered</p>
            </div>
          </motion.div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {links.map((link, index) => {
            const Icon = link.icon;
            const isActive = location === link.href;

            return (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={link.href}>
                  <div
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden cursor-pointer",
                      isActive
                        ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/10"
                        : "text-slate-400 hover:text-white hover:bg-gradient-to-r hover:from-slate-800/70 hover:to-slate-700/70 hover:border-slate-600/50 hover:shadow-md hover:shadow-slate-900/20 border border-transparent"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl"
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      />
                    )}
                    <Icon className={cn(
                      "w-5 h-5 relative z-10 transition-transform group-hover:scale-110",
                      isActive && "text-blue-400"
                    )} />
                    <span className="relative z-10 font-medium">{link.label}</span>
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto w-2 h-2 rounded-full bg-blue-500"
                      />
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/50">
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white mb-1 truncate">{displayName}</p>
                <p className="text-xs text-slate-400 truncate">{subtitle}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-green-400">Online</span>
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
        </div>
      </motion.aside>
    </>
  );
}
