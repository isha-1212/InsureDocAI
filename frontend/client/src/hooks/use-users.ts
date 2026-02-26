import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@/types/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

// Mock auth state (in a real app, this would be a Context or specialized hook)
// We'll use localStorage to persist the "mock" logged in user ID for this demo
const AUTH_KEY = "mediclaim_auth_user_id";
const ROLE_KEY = "mediclaim_auth_role";
const EMAIL_KEY = "mediclaim_auth_email";
const NAME_KEY = "mediclaim_auth_name";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const userId = localStorage.getItem(AUTH_KEY);
  const role = localStorage.getItem(ROLE_KEY) as 'user' | 'admin' | null;
  const email = localStorage.getItem(EMAIL_KEY);
  const name = localStorage.getItem(NAME_KEY);

  const loginMutation = useMutation({
    mutationFn: async (credentials: z.infer<typeof api.users.login.input>) => {
      const res = await fetch(api.users.login.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Login failed");
      return api.users.login.responses[200].parse(await res.json());
    },
    onSuccess: (user) => {
      localStorage.setItem(AUTH_KEY, String(user.id));
      localStorage.setItem(ROLE_KEY, user.role);
      if ((user as any).email) localStorage.setItem(EMAIL_KEY, (user as any).email);
      if ((user as any).username) localStorage.setItem(NAME_KEY, (user as any).username);
      toast({ title: "Welcome back!", description: `Logged in as ${user.username}` });
      // Force reload to update app state simply
      window.location.href = user.role === 'admin' ? '/admin' : '/portal';
    },
    onError: () => {
      toast({ title: "Login Failed", description: "Invalid credentials", variant: "destructive" });
    }
  });

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem('access_token');
    window.location.href = '/';
  };

  return {
    userId: userId,  // Return as string (UUID) instead of integer
    role,
    email,
    name,
    login: loginMutation.mutate,
    isPending: loginMutation.isPending,
    logout
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
