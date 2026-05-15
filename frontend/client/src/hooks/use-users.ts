import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@/types/routes";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
      setIsLoading(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const role = (user?.user_metadata?.role || user?.app_metadata?.role || null) as 'user' | 'admin' | null;
  const email = user?.email ?? null;
  const name =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    null;

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return {
    session,
    userId: user?.id ?? null,
    role,
    email,
    name,
    isLoading,
    logout,
  };
}

export function useUser(id: number) {
  return useQuery({
    queryKey: [api.users.get.path, id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const url = buildUrl(api.users.get.path, { id });
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error("Failed to fetch user");
      return api.users.get.responses[200].parse(await res.json());
    },
    enabled: !!id
  });
}
