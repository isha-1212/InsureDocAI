import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@/types/routes";
import type { CreateClaimRequest } from "@/types/schema";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export function useUserClaims(userId: string) {
  return useQuery({
    queryKey: [api.claims.listByUser.path, userId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const url = buildUrl(api.claims.listByUser.path, { userId });
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error("Failed to fetch claims");
      return api.claims.listByUser.responses[200].parse(await res.json());
    },
    enabled: !!userId
  });
}

export function useAllClaims() {
  return useQuery({
    queryKey: [api.claims.listAll.path],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(api.claims.listAll.path, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error("Failed to fetch claims");
      return api.claims.listAll.responses[200].parse(await res.json());
    }
  });
}

export function useClaim(id: number) {
  return useQuery({
    queryKey: [api.claims.get.path, id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const url = buildUrl(api.claims.get.path, { id });
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error("Failed to fetch claim");
      return api.claims.get.responses[200].parse(await res.json());
    },
    enabled: !!id
  });
}

export function useCreateClaim() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateClaimRequest) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(api.claims.create.path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to submit claim");
      return api.claims.create.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.claims.listByUser.path, data.userId] });
      toast({ title: "Claim Submitted", description: "Your claim has been submitted for processing." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });
}

export function useUpdateClaimStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: number, status: 'approved' | 'rejected', rejectionReason?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const url = buildUrl(api.claims.updateStatus.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status, rejectionReason }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update claim status");
      return api.claims.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.claims.listAll.path] });
      queryClient.invalidateQueries({ queryKey: [api.claims.get.path] });
      toast({ title: "Status Updated", description: "Claim status has been changed successfully." });
    },
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: [api.admin.stats.path],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(api.admin.stats.path, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.admin.stats.responses[200].parse(await res.json());
    }
  });
}
