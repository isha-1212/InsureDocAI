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
    { id: "1", claimNumber: "CLM-2026-1247", status: "approved", amount: "₹34,100", type: "Consultation", icon: "file" },
    { id: "2", claimNumber: "CLM-2026-1246", status: "processing", amount: "₹67,000", type: "Pharmacy", icon: "activity" },
    { id: "3", claimNumber: "CLM-2026-1245", status: "verified", amount: "₹18,500", type: "Lab Tests", icon: "check" },
    { id: "4", claimNumber: "CLM-2026-1244", status: "approved", amount: "₹1,25,000", type: "Surgery", icon: "stethoscope" },
    { id: "5", claimNumber: "CLM-2026-1243", status: "processing", amount: "₹45,800", type: "Hospitalization", icon: "activity" },
    { id: "6", claimNumber: "CLM-2026-1242", status: "verified", amount: "₹8,200", type: "Pharmacy", icon: "file" },
    { id: "7", claimNumber: "CLM-2026-1241", status: "approved", amount: "₹52,600", type: "Diagnostic", icon: "check" },
    { id: "8", claimNumber: "CLM-2026-1240", status: "processing", amount: "₹89,400", type: "Emergency Care", icon: "stethoscope" },
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

    return (
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-3 sm:p-4 lg:p-5 shadow-2xl hover:bg-white/15 transition-all duration-300 mb-3 lg:mb-4">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-blue-600/30 flex items-center justify-center backdrop-blur-sm">
                        <IconComponent icon={claim.icon} />
                    </div>
                    <div>
                        <p className="text-[10px] sm:text-xs font-mono text-blue-200/80 tracking-wide">{claim.claimNumber}</p>
                        <p className="text-xs sm:text-sm text-white/90 font-medium mt-0.5">{claim.type}</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-lg sm:text-xl lg:text-2xl font-serif font-semibold text-white">{claim.amount}</p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[claim.status]}`}>
                    {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                </span>
            </div>
        </div>
    );
};

export default function AnimatedBackground() {
    // Duplicate the claims array for seamless infinite scroll
    const duplicatedClaims = [...mockClaims, ...mockClaims, ...mockClaims];

    return (
        <div className="flex w-full lg:w-[40%] h-[34vh] sm:h-[42vh] lg:h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
            {/* Background Texture Overlay */}
            <div
                className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: 'url(https://images.unsplash.com/photo-1644350341494-2ddc19a69c8e?crop=entropy&cs=srgb&fm=jpg&q=85)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    mixBlendMode: 'overlay'
                }}
            />

            {/* Floating Abstract Shapes */}
            <div className="absolute top-20 left-10 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px] animate-float" />
            <div className="absolute bottom-40 right-20 w-80 h-80 bg-cyan-400/15 rounded-full blur-[120px] animate-float" style={{ animationDelay: '2s' }} />
            <div className="absolute top-1/2 left-1/4 w-56 h-56 bg-purple-400/10 rounded-full blur-[80px] animate-float" style={{ animationDelay: '4s' }} />

            {/* Gradient Orbs */}
            <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-gradient-to-tl from-cyan-500/20 to-transparent rounded-full blur-3xl" />

            {/* Content Container */}
            <div className="relative z-10 w-full flex flex-col items-center justify-center px-4 sm:px-8 lg:px-12 py-5 sm:py-8 lg:py-16">
                {/* Top Header */}
                <div className="text-center mb-4 sm:mb-6 lg:mb-12">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl lg:rounded-3xl flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 shadow-2xl mx-auto shadow-blue-500/20 border border-white/10">
                        <Activity className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-white" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl lg:text-5xl font-serif font-bold bg-gradient-to-r from-white via-slate-200 to-white bg-clip-text text-transparent mb-1 sm:mb-2 lg:mb-3 tracking-tight">
                        MediClaim AI
                    </h1>
                    <p className="text-slate-300 text-sm sm:text-base lg:text-lg font-medium">Processing Claims with Clinical Precision</p>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center justify-center gap-6 lg:gap-8 mt-4 lg:mt-8">
                        <div className="text-center">
                            <p className="text-2xl lg:text-3xl font-serif font-bold text-white">2,547<span className="text-lg lg:text-xl text-slate-400">+</span></p>
                            <p className="text-xs text-slate-400 mt-1 font-medium tracking-wide">Claims Processed</p>
                        </div>
                        <div className="w-px h-12 bg-white/20" />
                        <div className="text-center">
                            <p className="text-2xl lg:text-3xl font-serif font-bold text-white">94.2<span className="text-lg lg:text-xl text-slate-400">%</span></p>
                            <p className="text-xs text-slate-400 mt-1 font-medium tracking-wide">Approval Rate</p>
                        </div>
                        <div className="w-px h-12 bg-white/20" />
                        <div className="text-center">
                            <p className="text-2xl lg:text-3xl font-serif font-bold text-white">36<span className="text-lg lg:text-xl text-slate-400">h</span></p>
                            <p className="text-xs text-slate-400 mt-1 font-medium tracking-wide">Avg. Processing</p>
                        </div>
                    </div>
                </div>

                {/* Scrolling Claims Container */}
                <div className="relative w-full max-w-md h-[170px] sm:h-[230px] lg:h-[400px] overflow-hidden mask-gradient">
                    <div className="animate-infinite-scroll-y">
                        {duplicatedClaims.map((claim, index) => (
                            <ClaimCardComponent key={`${claim.id}-${index}`} claim={claim} />
                        ))}
                    </div>
                </div>

                {/* Bottom Label */}
                <div className="mt-3 sm:mt-4 lg:mt-8 backdrop-blur-md bg-white/10 border border-white/20 rounded-full px-4 lg:px-6 py-2 shadow-xl">
                    <p className="text-sm text-slate-200 font-medium">
                        <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse" />
                        Live Claim Processing
                    </p>
                </div>
            </div>

            {/* Gradient Overlay at edges for fade effect */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-slate-950/20" />
        </div>
    );
}
