import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-users";
import { usePolicies } from "@/hooks/use-policies";
import { useMembers, useAddMember } from "@/hooks/use-members";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFamilyMemberSchema } from "@/types/schema";
import { User, Users, Plus, Calendar, Heart, Edit, Trash2, UserCircle } from "lucide-react";
import { format, differenceInYears } from "date-fns";
import { motion } from "framer-motion";
import { useState } from "react";

// Animation variants - staggered cards with fade and slide
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 80,
      damping: 15,
      duration: 0.6
    }
  }
};

export default function FamilyMembers() {
  const { userId } = useAuth();
  const { data: policy } = usePolicies(userId!);
  const { data: members, isLoading } = useMembers(policy?.id || 0);
  const { mutate: addMember, isPending } = useAddMember();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(insertFamilyMemberSchema.omit({ policy: true })),
    defaultValues: {
      name: "",
      dob: "",
      relation: "spouse"
    }
  });

  const onSubmit = (data: any) => {
    addMember({
      policy: policy!.id,
      name: data.name,
      dob: data.dob,
      relation: data.relation
    }, {
      onSuccess: () => {
        form.reset();
        setDialogOpen(false);
      }
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-5 sm:py-8 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-10 bg-slate-700/50 rounded w-64 mb-2 animate-pulse"></div>
              <div className="h-5 bg-slate-700/30 rounded w-96 animate-pulse"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800/50 animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-slate-700/50 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-6 bg-slate-700/50 rounded w-32 mb-2"></div>
                    <div className="h-4 bg-slate-700/30 rounded w-24"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-slate-700/20 rounded w-full"></div>
                  <div className="h-4 bg-slate-700/20 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!policy) {
    return (
      <Layout>
        <div className="text-center pt-20">
          <h2 className="text-xl font-bold">No Policy Found</h2>
          <p className="text-muted-foreground">Please create a policy first.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-4xl font-display font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Family Members</h1>
            <p className="text-slate-400 text-sm md:text-lg mt-1.5">Manage beneficiaries under your policy</p>
          </div>

          {policy.status === 'approved' && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto h-10 md:h-11 gap-2 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 hover:from-blue-600 hover:via-cyan-600 hover:to-blue-700 text-white text-sm md:text-base font-semibold shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 active:scale-95 rounded-xl px-4 md:px-6 border border-blue-400/20">
                  <Plus className="w-4 h-4 md:w-5 md:h-5" /> Add Member
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 w-[95vw] max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/30">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    Add Family Member
                  </DialogTitle>
                  <p className="text-slate-400 text-sm mt-2">Add a new beneficiary to your insurance policy</p>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300 font-medium">Full Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter full name"
                              className="h-11 bg-slate-800 border-slate-700 hover:border-slate-600 focus:border-blue-500 text-white placeholder:text-slate-500"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="dob"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-300 font-medium">Date of Birth</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                className="h-11 bg-slate-800 border-slate-700 hover:border-slate-600 focus:border-blue-500 text-white"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="relation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-300 font-medium">Relation</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 bg-slate-800 border-slate-700 hover:border-slate-600 focus:border-blue-500 text-white">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="self" className="text-white hover:bg-slate-700">Self</SelectItem>
                                <SelectItem value="spouse" className="text-white hover:bg-slate-700">Spouse</SelectItem>
                                <SelectItem value="child" className="text-white hover:bg-slate-700">Child</SelectItem>
                                <SelectItem value="parent" className="text-white hover:bg-slate-700">Parent</SelectItem>
                                <SelectItem value="father" className="text-white hover:bg-slate-700">Father</SelectItem>
                                <SelectItem value="mother" className="text-white hover:bg-slate-700">Mother</SelectItem>
                                <SelectItem value="son" className="text-white hover:bg-slate-700">Son</SelectItem>
                                <SelectItem value="daughter" className="text-white hover:bg-slate-700">Daughter</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 hover:from-purple-600 hover:via-pink-600 hover:to-blue-600 text-white shadow-xl shadow-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 active:scale-95 rounded-xl border border-purple-400/20"
                      disabled={isPending}
                    >
                      {isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          Adding Member...
                        </>
                      ) : (
                        <>
                          <Plus className="w-5 h-5 mr-2" />
                          Add Member
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Always show Self card first */}
          <motion.div
            whileHover={{ scale: 1.05, y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-2xl hover:shadow-blue-500/20 transition-all group relative overflow-hidden backdrop-blur-sm"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center border-4 border-blue-400/30 shadow-lg group-hover:scale-110 transition-transform">
                  <UserCircle className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-full border border-blue-400/30 uppercase tracking-wider">
                  Primary
                </span>
              </div>
              <h3 className="text-lg md:text-2xl font-bold text-white mb-1.5 group-hover:text-blue-300 transition-colors">{policy.user?.username || "You"}</h3>
              <div className="flex items-center gap-2 text-xs md:text-sm text-slate-400 mb-2.5">
                <Heart className="w-3.5 h-3.5 md:w-4 md:h-4 text-rose-400" />
                <span>Self • Policyholder</span>
              </div>
              <div className="pt-3 border-t border-slate-700/50">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Role</p>
                <p className="text-white font-semibold">Primary Insured</p>
              </div>
            </div>
          </motion.div>

          {(() => {
            const arr = Array.isArray(members)
              ? members
              : (members && Array.isArray(members.results))
                ? members.results
                : (members && Array.isArray(members.family_members))
                  ? members.family_members
                  : [];
            // Remove duplicates by name, relation, and dob
            const seen = new Set();
            const filteredMembers = arr.filter(m => {
              const key = `${m.name}|${m.relation}|${m.dob}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

            if (filteredMembers.length === 0) {
              return (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="col-span-full bg-gradient-to-br from-slate-900/60 via-slate-800/40 to-slate-900/60 rounded-2xl p-10 text-center border border-dashed border-slate-700/50 backdrop-blur-sm"
                >
                  <div className="max-w-sm mx-auto">
                    <div className="w-20 h-20 bg-gradient-to-br from-slate-800/80 to-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-600/50 shadow-lg">
                      <Users className="w-10 h-10 text-slate-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">No Family Members Added</h3>
                    <p className="text-slate-400 mb-6 text-sm leading-relaxed">
                      Add your family members to extend coverage and submit claims on their behalf.
                    </p>
                    <Button
                      onClick={() => setDialogOpen(true)}
                      className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium px-6 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/50 transition-all duration-300"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Member
                    </Button>
                  </div>
                </motion.div>
              );
            }

            return filteredMembers.map((member) => {
              const age = member.dob ? differenceInYears(new Date(), new Date(member.dob)) : null;
              const relationColors: Record<string, string> = {
                spouse: "from-pink-500/10 to-rose-500/10 border-pink-500/30",
                child: "from-cyan-500/10 to-blue-500/10 border-cyan-500/30",
                parent: "from-amber-500/10 to-orange-500/10 border-amber-500/30",
                father: "from-amber-500/10 to-orange-500/10 border-amber-500/30",
                mother: "from-pink-500/10 to-purple-500/10 border-pink-500/30",
                son: "from-cyan-500/10 to-blue-500/10 border-cyan-500/30",
                daughter: "from-pink-500/10 to-purple-500/10 border-pink-500/30",
              };
              const cardColor = relationColors[member.relation] || "from-slate-500/10 to-slate-600/10 border-slate-500/30";

              return (
                <motion.div
                  key={member.id}
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`bg-gradient-to-br ${cardColor} border-2 rounded-2xl p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group relative overflow-hidden backdrop-blur-sm`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border-4 border-slate-600/50 shadow-lg text-2xl font-bold text-white group-hover:scale-110 transition-transform">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${member.is_minor
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                          }`}>
                          {member.is_minor ? 'Minor' : 'Adult'}
                        </span>
                      </div>
                    </div>
              <h3 className="text-lg md:text-2xl font-bold text-white mb-1.5 truncate group-hover:text-blue-300 transition-colors">{member.name}</h3>
              <div className="flex items-center gap-2 text-xs md:text-sm text-slate-400 mb-1">
                {member.is_minor ? (
                  <Heart className="w-3.5 h-3.5 md:w-4 md:h-4 text-rose-400" />
                ) : (
                  <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-400" />
                )}
                <span className="capitalize">{member.relation}</span>
              </div>
              <div className="flex items-center gap-2 text-xs md:text-sm text-slate-500 mb-3.5">
                <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5" />
                <span>{member.dob}</span>
                {age !== null && <span className="text-slate-600">• {age} years</span>}
              </div>
                    <div className="flex gap-2 pt-3 border-t border-slate-700/50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                      <button className="flex-1 px-2.5 py-1.5 md:px-3 md:py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 text-xs md:text-sm font-medium rounded-lg border border-blue-500/30 hover:border-blue-400/50 transition-all flex items-center justify-center gap-1.5 md:gap-2">
                        <Edit className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        Edit
                      </button>
                      <button className="flex-1 px-2.5 py-1.5 md:px-3 md:py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs md:text-sm font-medium rounded-lg border border-red-500/30 hover:border-red-400/50 transition-all flex items-center justify-center gap-1.5 md:gap-2">
                        <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            });
          })()}
        </motion.div>
      </motion.div>
    </Layout>
  );
}
