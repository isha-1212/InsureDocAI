import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@/types/routes";
import type { InsertFamilyMember } from "@/types/schema";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export function useMembers(policyId: number) {
  return useQuery({
    queryKey: ['family-members', policyId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const url = buildUrl(api.members.list.path, { policy: policyId });
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error("Failed to fetch members");
      return api.members.list.responses[200].parse(await res.json());
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

      const res = await fetch(api.members.create.path, {
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
        let message = "Failed to add member";
        if (typeof error === 'string') {
          message = error;
        } else if (error.detail) {
          if (error.detail === 'Person already exists.') {
            message = 'Person already exists.';
          } else {
            message = error.detail;
          }
        } else if (error.error) {
          message = error.error;
        } else if (typeof error === 'object' && error !== null) {
          // Collect all field errors
          message = Object.entries(error)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join(' | ');
        }
        throw new Error(message);
      }
      return api.members.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['family-members', variables.policy] });
      queryClient.invalidateQueries({ queryKey: ['user-policy'] });
      toast({ title: "Member Added", description: "Family member successfully added to policy." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });
}
