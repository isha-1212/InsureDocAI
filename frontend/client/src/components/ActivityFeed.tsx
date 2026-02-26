import { motion } from "framer-motion";
import {
    FileText,
    Users,
    ClipboardCheck,
    Upload,
    CheckCircle,
    AlertTriangle,
    Clock,
    TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ActivityItem {
    id: string;
    type: 'document_processed' | 'user_registered' | 'claim_submitted' | 'policy_created';
    title: string;
    description: string;
    timestamp: string;
    user?: string;
    status?: 'success' | 'warning' | 'error';
}

interface ActivityFeedProps {
    activities?: ActivityItem[];
    className?: string;
}

const activityIcons = {
    document_processed: FileText,
    user_registered: Users,
    claim_submitted: ClipboardCheck,
    policy_created: Upload,
};

const statusColors = {
    success: "text-emerald-500",
    warning: "text-amber-500",
    error: "text-red-500",
};

// Mock data for demonstration
const mockActivities: ActivityItem[] = [
    {
        id: "1",
        type: "document_processed",
        title: "Hospital Bill Processed",
        description: "AI extracted data from Apollo Hospital bill with 95% confidence",
        timestamp: "2 minutes ago",
        user: "System AI",
        status: "success"
    },
    {
        id: "2",
        type: "claim_submitted",
        title: "New Claim Submitted",
        description: "Patient John Doe submitted claim for ₹25,000",
        timestamp: "5 minutes ago",
        user: "John Doe",
        status: "success"
    },
    {
        id: "3",
        type: "user_registered",
        title: "New User Registration",
        description: "Sarah Wilson registered with family coverage",
        timestamp: "10 minutes ago",
        user: "Sarah Wilson",
        status: "success"
    },
    {
        id: "4",
        type: "document_processed",
        title: "PAN Card Verification",
        description: "PAN verification completed with low confidence - manual review required",
        timestamp: "15 minutes ago",
        user: "System AI",
        status: "warning"
    },
    {
        id: "5",
        type: "policy_created",
        title: "Policy Document Created",
        description: "New family health policy created for account #12845",
        timestamp: "20 minutes ago",
        user: "Admin",
        status: "success"
    }
];

export function ActivityFeed({ activities = mockActivities, className }: ActivityFeedProps) {
    return (
        <Card className={`hover:shadow-lg transition-all duration-300 ${className}`}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                        </div>
                        <CardTitle className="text-lg">Recent Activity</CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                        Live
                        <div className="ml-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                    {activities.map((activity, index) => {
                        const Icon = activityIcons[activity.type];
                        const statusColor = activity.status ? statusColors[activity.status] : "text-slate-500";

                        return (
                            <motion.div
                                key={activity.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <div className={`p-2 rounded-full bg-slate-100 ${statusColor}`}>
                                    <Icon className="w-4 h-4" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-medium text-slate-900 truncate">
                                            {activity.title}
                                        </h4>
                                        <time className="text-xs text-slate-500 shrink-0">
                                            {activity.timestamp}
                                        </time>
                                    </div>

                                    <p className="text-sm text-slate-600 mb-2">
                                        {activity.description}
                                    </p>

                                    {activity.user && (
                                        <div className="flex items-center gap-2">
                                            <Avatar className="w-5 h-5">
                                                <AvatarFallback className="text-xs bg-slate-200">
                                                    {activity.user.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs text-slate-500">{activity.user}</span>

                                            {activity.status && (
                                                <div className="ml-auto">
                                                    {activity.status === 'success' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                                                    {activity.status === 'warning' && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                                                    {activity.status === 'error' && <Clock className="w-3 h-3 text-red-500" />}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}