import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { logSupabaseStartupDiagnostics, recoverSupabaseAuthState } from "@/lib/supabase";
import { runSupabaseAuthProbe } from "@/lib/supabase-auth-probe";

declare global {
    interface Window {
        runSupabaseAuthProbe?: () => Promise<unknown>
    }
}

async function bootstrap() {
    if (import.meta.env.DEV) {
        window.runSupabaseAuthProbe = runSupabaseAuthProbe;
    }

    await logSupabaseStartupDiagnostics();
    await recoverSupabaseAuthState();
    createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap();
