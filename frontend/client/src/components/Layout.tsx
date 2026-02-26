import { useState } from 'react';
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { motion } from 'framer-motion';

interface LayoutProps {
  children: React.ReactNode;
  scrollable?: boolean;
}

export function Layout({ children, scrollable = true }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`flex-1 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 ${scrollable ? "overflow-y-auto" : "overflow-hidden"
            }`}
        >
          <div className={scrollable ? "p-4 lg:p-8 pb-12" : "p-4 lg:p-8 h-full"}>
            {children}
          </div>
        </motion.main>
      </div>
    </div>
  );
}
