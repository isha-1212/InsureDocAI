import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@/types/routes";
import type { InsertPolicy } from "@/types/schema";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export function usePolicies(userId?: string) {
  return useQuery({
    queryKey: [userId ? 'user-policy' : 'all-policies', userId],
    queryFn: async () => {
      if (userId) {
        // Get Supabase session token
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        // Fetch single user policy using my_policy endpoint
        const res = await fetch(api.policies.getByUser.path, {
          credentials: "include",
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (!res.ok) throw new Error("Failed to fetch policy");
        const data = await res.json();
        if (!data.has_policy) return null;
        return data.policy;
      } else {
        // Get Supabase session token
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        // Fetch all policies (admin)
        const res = await fetch(api.policies.list.path, {
          credentials: "include",
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (!res.ok) throw new Error("Failed to fetch policies");
        const raw = await res.json();
        const parsed = api.policies.list.responses[200].parse(raw);

        // Backend list endpoint returns { count, policies: [...] }
        // but be defensive in case it's a bare array
        if (Array.isArray(parsed)) {
          return parsed;
        }
        if (Array.isArray((parsed as any).policies)) {
          return (parsed as any).policies;
        }
        return [];
      }
    },
    enabled: userId !== undefined || !userId
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertPolicy) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(api.policies.create.path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        // Better error message handling
        if (error.error && error.error.includes('already have a policy')) {
          throw new Error('You already have a policy submitted. Only one policy per family is allowed.');
        }
        throw new Error(error.error || error.message || error.detail || "Failed to create policy");
      }
      return api.policies.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-policy'] });
      toast({ title: "Policy Submitted", description: "Your policy is under review." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });
}

export function useUpdatePolicyStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: number, status: 'approved' | 'rejected', rejectionReason?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // DRF @action endpoint is defined as POST /policies/{id}/update_status/
      const url = api.policies.updateStatus.path.replace(":id", String(id));
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        // Backend expects snake_case field "rejection_reason"
        body: JSON.stringify({ status, rejection_reason: rejectionReason }),
        credentials: "include",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const rejectionMsg = Array.isArray((errBody as any).rejection_reason)
          ? (errBody as any).rejection_reason[0]
          : (errBody as any).rejection_reason;
        throw new Error(
          (errBody as any).error ||
          (errBody as any).detail ||
          rejectionMsg ||
          "Failed to update status"
        );
      }
      return api.policies.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      // Refresh all admin policy lists and any cached policy detail/user views
      queryClient.invalidateQueries({ queryKey: ['all-policies'] });
      queryClient.invalidateQueries({ queryKey: ['user-policy'] });
      queryClient.invalidateQueries({ queryKey: ['policy-detail'] });
      toast({ title: "Status Updated", description: "Policy status has been changed successfully." });
    },
  });
}
