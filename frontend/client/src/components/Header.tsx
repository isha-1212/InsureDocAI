import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
    onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50"
        >
            <div className="flex items-center px-4 lg:px-8 py-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onMenuClick}
                    className="lg:hidden text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200"
                >
                    <Menu className="w-5 h-5" />
                </Button>
            </div>
        </motion.header>
    );
}