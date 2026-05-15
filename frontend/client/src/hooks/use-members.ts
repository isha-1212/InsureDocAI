import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@/types/routes";
import type { InsertFamilyMember } from "@/types/schema";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const MEMBER_REQUEST_TIMEOUT_MS = 12000;

async function fetchJsonWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), MEMBER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

    return { response, payload };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) return payload;

  if (payload && typeof payload === "object") {
    const error = payload as Record<string, unknown>;
    if (typeof error.detail === "string") return error.detail;
    if (typeof error.error === "string") return error.error;

    const fieldErrors = Object.entries(error)
      .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`)
      .join(" | ");

    if (fieldErrors) return fieldErrors;
  }

  return fallback;
}

export function useMembers(policyId: number) {
  return useQuery({
    queryKey: ['family-members', policyId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const url = buildUrl(api.members.list.path, { policy: policyId });
      const { response, payload } = await fetchJsonWithTimeout(url, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, "Failed to fetch members"));
      }
      return api.members.list.responses[200].parse(payload);
    },
    enabled: !!policyId && policyId > 0
  });
}

export function useAddMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertFamilyMember) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const { response, payload } = await fetchJsonWithTimeout(api.members.create.path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, "Failed to add member"));
      }
      return api.members.create.responses[201].parse(payload);
    },
    onSuccess: (createdMember, variables) => {
      queryClient.setQueryData(['family-members', variables.policy], (current: any) => {
        if (Array.isArray(current)) {
          return [...current, createdMember];
        }
        if (current && Array.isArray(current.results)) {
          return { ...current, results: [...current.results, createdMember] };
        }
        if (current && Array.isArray(current.family_members)) {
          return { ...current, family_members: [...current.family_members, createdMember] };
        }
        return [createdMember];
      });
      queryClient.invalidateQueries({ queryKey: ['family-members', variables.policy], refetchType: 'inactive' });
      queryClient.invalidateQueries({ queryKey: ['user-policy'] });
      toast({ title: "Member Added", description: "Family member successfully added to policy." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ memberId, policyId }: { memberId: number; policyId: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const url = api.members.delete(String(memberId));
      const { response, payload } = await fetchJsonWithTimeout(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, "Failed to delete member"));
      }
      return { memberId, policyId };
    },
    onSuccess: ({ memberId, policyId }) => {
      queryClient.setQueryData(['family-members', policyId], (current: any) => {
        if (Array.isArray(current)) {
          return current.filter((m: any) => m.id !== memberId);
        }
        if (current && Array.isArray(current.results)) {
          return { ...current, results: current.results.filter((m: any) => m.id !== memberId) };
        }
        if (current && Array.isArray(current.family_members)) {
          return { ...current, family_members: current.family_members.filter((m: any) => m.id !== memberId) };
        }
        return current;
      });
      queryClient.invalidateQueries({ queryKey: ['family-members', policyId], refetchType: 'inactive' });
      queryClient.invalidateQueries({ queryKey: ['user-policy'] });
      toast({ title: "Member Deleted", description: "Family member successfully removed from policy." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });
}
