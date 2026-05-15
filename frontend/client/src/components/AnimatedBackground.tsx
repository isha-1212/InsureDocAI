import { CheckCircle2, Activity, FileText, Stethoscope } from "lucide-react";

interface ClaimCard {
    id: string;
    claimNumber: string;
    status: "approved" | "processing" | "verified";
    amount: string;
    type: string;
    icon: "check" | "activity" | "file" | "stethoscope";
}

const mockClaims: ClaimCard[] = [
  { id: "1", claimNumber: "CLM-001", status: "approved", amount: "â‚¹4,800", type: "Hospital Bill", icon: "file" },
  { id: "2", claimNumber: "CLM-002", status: "processing", amount: "â‚¹7,250", type: "Pharmacy Invoice", icon: "activity" },
  { id: "3", claimNumber: "CLM-003", status: "verified", amount: "â‚¹2,100", type: "KYC Document Check", icon: "check" },
  { id: "4", claimNumber: "CLM-004", status: "approved", amount: "â‚¹12,400", type: "Treatment Summary", icon: "stethoscope" },
];

const IconComponent = ({ icon }: { icon: ClaimCard["icon"] }) => {
    const iconClass = "w-5 h-5 text-blue-100";
    switch (icon) {
        case "check":
            return <CheckCircle2 className={iconClass} />;
        case "activity":
            return <Activity className={iconClass} />;
        case "file":
            return <FileText className={iconClass} />;
        case "stethoscope":
            return <Stethoscope className={iconClass} />;
    }
};

const ClaimCardComponent = ({ claim }: { claim: ClaimCard }) => {
    const statusColors = {
        approved: "bg-blue-500/20 text-blue-100 border-blue-500/30",
        processing: "bg-amber-500/20 text-amber-100 border-amber-500/30",
        verified: "bg-cyan-500/20 text-cyan-100 border-cyan-500/30",
    };

    const statusText = {
        approved: "Approved âœ”",
        processing: "Under Review",
        verified: "Verified âœ“",
    };

    return (
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 shadow-2xl hover:bg-white/15 transition-all duration-300 mb-4">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center">
                        <IconComponent icon={claim.icon} />
                    </div>
                    <div>
                        <p className="text-xs font-mono text-blue-200/80 tracking-wide">
                            {claim.claimNumber}
                        </p>
                        <p className="text-sm text-white font-medium mt-1">
                            {claim.type}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-xl font-semibold text-white">
                    {claim.amount}
                </p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[claim.status]}`}>
                    {statusText[claim.status]}
                </span>
            </div>
        </div>
    );
};

export default function AnimatedBackground() {
    const duplicatedClaims = [...mockClaims, ...mockClaims, ...mockClaims];

    return (
        <div className="flex w-full lg:w-[40%] h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">

            {/* Background glow */}
            <div className="absolute top-20 left-10 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-40 right-20 w-80 h-80 bg-cyan-400/15 rounded-full blur-[120px]" />

            {/* Main content */}
            <div className="relative z-10 w-full flex flex-col items-center justify-center px-8 py-16">

                {/* ðŸ”¥ HERO SECTION */}
                <div className="text-center mb-10">

                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-3xl flex items-center justify-center mb-6 shadow-xl mx-auto">
                        <Activity className="w-10 h-10 text-white" />
                    </div>

                    <h1 className="text-5xl font-bold text-white mb-3">
                        InsureDoc AI
                    </h1>

                    <p className="text-lg text-slate-300 font-medium">
                        Intelligent Medical Claim Processing with AI Assistance
                    </p>

                    <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                        Streamline claim verification, detect anomalies, and assist decision-making through structured workflows.
                    </p>

                    {/* âœ… Realistic stats */}
                    <div className="flex items-center justify-center gap-8 mt-8">
                        <div>
                            <p className="text-2xl font-bold text-white">Multi</p>
                            <p className="text-xs text-slate-400">Claim Scenarios</p>
                        </div>

                        <div className="w-px h-10 bg-white/20" />

                        <div>
                            <p className="text-2xl font-bold text-white">3</p>
                            <p className="text-xs text-slate-400">Workflow Stages</p>
                        </div>

                        <div className="w-px h-10 bg-white/20" />

                        <div>
                            <p className="text-2xl font-bold text-white">Live</p>
                            <p className="text-xs text-slate-400">Interactive Dashboard</p>
                        </div>
                    </div>
                </div>

                {/* ðŸ”¥ CLAIM FEED */}
                <div className="relative w-full max-w-md h-[350px] overflow-hidden">
                    <div className="animate-infinite-scroll-y">
                        {duplicatedClaims.map((claim, index) => (
                            <ClaimCardComponent key={`${claim.id}-${index}`} claim={claim} />
                        ))}
                    </div>
                </div>

                {/* ðŸ”¥ FOOTER TEXT */}
                <div className="mt-6 backdrop-blur-md bg-white/10 border border-white/20 rounded-full px-6 py-2">
                    <p className="text-sm text-slate-200 font-medium">
                        â— Real-time Claim Workflow Preview
                    </p>
                </div>
            </div>
        </div>
    );
}
