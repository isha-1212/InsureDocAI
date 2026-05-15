import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-users";
import { usePolicies } from "@/hooks/use-policies";
import { useMembers } from "@/hooks/use-members";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, Check, UploadCloud, AlertCircle, CheckCircle2, User, IndianRupee, FileUp } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

// Animation variants - zoom from center
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 110,
      damping: 18,
      duration: 0.65
    }
  }
};

const documentTypeSchema = z.enum(["hospital_bill", "pharmacy_bill", "aadhaar", "pan", "birth_certificate"]);

const createClaimFormSchema = z.object({
  memberId: z.coerce.number(),
  totalAmount: z.coerce.number().min(1, "Amount must be greater than 0"),
  // Document upload - allow File objects or null
  hospitalBill: z.any().optional(),
  pharmacyBill: z.any().optional(),
  aadhaar: z.any().optional(),
  pan: z.any().optional(),
  birthCert: z.any().optional(),
});

export default function NewClaim() {
  const { userId } = useAuth();
  const { data: policy } = usePolicies(userId!);
  const { data: members } = useMembers(policy?.id || 0);
  
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [dragActive, setDragActive] = useState<string | null>(null);
  const totalCoverage = Number((policy as any)?.total_coverage_amount || 0);
  const usedCoverage = Number((policy as any)?.used_coverage_amount || 0);
  const remainingCoverage = Number((policy as any)?.remaining_coverage_amount || Math.max(totalCoverage - usedCoverage, 0));

  const form = useForm({
    resolver: zodResolver(createClaimFormSchema),
    defaultValues: {
      memberId: "",
      totalAmount: "",
      hospitalBill: null,
      pharmacyBill: null,
      aadhaar: null,
      pan: null,
      birthCert: null
    }
  });
  const enteredAmount = Number(form.watch('totalAmount') || 0);
  const exceedsCoverage = enteredAmount > 0 && remainingCoverage > 0 && enteredAmount > remainingCoverage;

  const getMembersArray = () => {
    if (Array.isArray(members)) return members;
    if (members && Array.isArray(members.results)) return members.results;
    if (members && Array.isArray(members.family_members)) return members.family_members;
    return [];
  };

  const onMemberChange = (val: string) => {
    form.setValue("memberId", val);
    const arr = getMembersArray();
    console.log('Selected value:', val, 'Members array:', arr);
    const member = arr.find((m: any) => m.id?.toString() === val);
    if (!member) {
      console.warn('No member found for value:', val);
    }
    setSelectedMember(member || null);
    if (member) setCurrentStep(2);
  };

  const onSubmit = async (data: any) => {
    if (!policy) return;

    console.log('Submitting claim with data:', data);
    setIsSubmitting(true);

    // Create FormData to send files to Django
    const formData = new FormData();
    formData.append('user_id', userId!);
    formData.append('policy_id', policy.id.toString());
    formData.append('member_id', data.memberId.toString());
    formData.append('total_amount', data.totalAmount.toString());

    // Add files if they exist
    if (data.hospitalBill) {
      formData.append('hospital_bill', data.hospitalBill);
    }
    if (data.pharmacyBill) {
      formData.append('pharmacy_bill', data.pharmacyBill);
    }
    if (data.aadhaar) {
      formData.append('aadhaar', data.aadhaar);
    }
    if (data.pan) {
      formData.append('pan', data.pan);
    }
    if (data.birthCert) {
      formData.append('birth_certificate', data.birthCert);
    }

    try {
      // Send to Django backend - Django will handle Supabase upload and DB save
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('http://localhost:8000/api/claims/', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Server error:', errorData);
        throw new Error(errorData.detail || 'Failed to submit claim');
      }

      const result = await res.json();
      console.log('Claim submitted successfully:', result);
      // Show success message and redirect
      alert('Claim submitted successfully!');
      window.location.href = '/portal/claims';
    } catch (error) {
      console.error('Claim submission error:', error);
      alert(`Failed to submit claim: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for rendering upload field with drag and drop
  const UploadField = ({ name, label, required = false, disabled = false }: { name: string, label: string, required?: boolean, disabled?: boolean }) => {
    const fieldValue = form.watch(name as any);
    const isDragging = dragActive === name;

    const handleDrag = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(name);
      } else if (e.type === "dragleave") {
        setDragActive(null);
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(null);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        form.setValue(name as any, e.dataTransfer.files[0]);
      }
    };

    return (
      <FormField
        control={form.control}
        name={name as any}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-slate-300">
              {label} {required && <span className="text-red-400">*</span>}
            </FormLabel>
            <FormControl>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${isDragging
                  ? 'border-blue-400 bg-blue-500/10'
                  : fieldValue
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                  }`}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => {
                    if (disabled) return;
                    const file = e.target.files?.[0] || null;
                    field.onChange(file);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0"
                  disabled={disabled}
                />
                {fieldValue && typeof fieldValue === 'object' ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-300">{fieldValue.name}</p>
                      <p className="text-xs text-slate-400">{(fieldValue.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center py-2">
                    <UploadCloud className={`w-8 h-8 mb-2 ${isDragging ? 'text-blue-400' : 'text-slate-400'}`} />
                    <p className="text-sm text-slate-300 font-medium">
                      {isDragging ? 'Drop file here' : 'Click or drag to upload'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">PDF or Image (max 5MB)</p>
                  </div>
                )}
              </div>
            </FormControl>
            {disabled && (
              <p className="text-xs text-rose-400 mt-2">Cannot upload documents because entered amount exceeds remaining coverage.</p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  // If policy exists but is not approved, block claim creation UI
  if (policy && (policy as any).status !== 'approved') {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-24 text-center">
          <h2 className="text-2xl font-bold">Policy Not Approved</h2>
          <p className="text-slate-400 mt-3">Your policy is not yet approved by the administrator. You cannot submit claims until the policy is approved.</p>
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
        className="max-w-4xl mx-auto px-1 sm:px-0"
      >
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-display font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-3">New Claim Request</h1>
          <p className="text-slate-400 text-base sm:text-lg">Submit a new insurance claim for reimbursement.</p>
        </motion.div>

        {/* Step Indicator */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[640px] flex items-center justify-between relative">
            {/* Progress Bar Background */}
            <div className="absolute top-5 left-0 right-0 h-1 bg-slate-800 rounded-full" />
            <div
              className="absolute top-5 left-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
            />

            {/* Steps */}
            {[
              { num: 1, label: "Select Patient", icon: User },
              { num: 2, label: "Enter Amount", icon: IndianRupee },
              { num: 3, label: "Upload Documents", icon: FileUp },
              { num: 4, label: "Submit", icon: CheckCircle2 }
            ].map((step) => (
              <div key={step.num} className="relative flex flex-col items-center z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${currentStep >= step.num
                  ? 'bg-gradient-to-br from-blue-500 to-purple-500 border-blue-400 shadow-lg shadow-blue-500/50'
                  : 'bg-slate-800 border-slate-700'
                  }`}>
                  {currentStep > step.num ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : (
                    <step.icon className={`w-5 h-5 ${currentStep >= step.num ? 'text-white' : 'text-slate-500'}`} />
                  )}
                </div>
                <p className={`text-xs mt-2 font-medium text-center ${currentStep >= step.num ? 'text-white' : 'text-slate-500'
                  }`}>
                  {step.label}
                </p>
              </div>
            ))}
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 backdrop-blur-xl border-slate-800">
            <CardContent className="p-4 sm:p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Step 1: Select Patient */}
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="memberId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-lg font-semibold text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-400" />
                            Select Patient
                          </FormLabel>
                          <Select onValueChange={onMemberChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-12 bg-slate-800 border-slate-700 hover:border-slate-600 focus:border-blue-500 text-white">
                                <SelectValue placeholder="Choose family member for this claim" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              {getMembersArray().map((member: any) => (
                                <SelectItem key={member.id} value={member.id.toString()} className="text-white hover:bg-slate-700">
                                  {member.name} ({member.relation})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Step 2: Enter Amount */}
                    {selectedMember && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={{ duration: 0.3 }}
                      >
                        <FormField
                          control={form.control}
                          name="totalAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-lg font-semibold text-white flex items-center gap-2">
                                <IndianRupee className="w-5 h-5 text-emerald-400" />
                                Claim Amount
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">₹</span>
                                  <Input
                                    type="number"
                                    placeholder="0.00"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      if (e.target.value && parseFloat(e.target.value) > 0) {
                                        setCurrentStep(3);
                                      }
                                    }}
                                    className="h-12 pl-8 bg-slate-800 border-slate-700 hover:border-slate-600 focus:border-emerald-500 text-white text-lg"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                              {remainingCoverage > 0 && (
                                <div className={`mt-3 rounded-xl border p-3 text-sm ${exceedsCoverage ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-slate-700 bg-slate-800/40 text-slate-300'}`}>
                                  <p>Total Coverage: ₹{totalCoverage.toFixed(0)}</p>
                                  <p>Used Coverage: ₹{usedCoverage.toFixed(0)}</p>
                                  <p>Remaining Coverage: ₹{remainingCoverage.toFixed(0)}</p>
                                  {exceedsCoverage && (
                                    <p className="mt-2 font-medium text-rose-300">Requested amount exceeds remaining coverage.</p>
                                  )}
                                </div>
                              )}
                            </FormItem>
                          )}
                        />
                      </motion.div>
                    )}
                  </div>

                  {/* Step 3: Upload Documents */}
                  {selectedMember && form.watch('totalAmount') && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6 pt-6 border-t border-slate-700"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/30">
                          <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-xl text-white">Required Documents</h3>
                          <p className="text-sm text-slate-400">Upload clear photos or PDF scans</p>
                        </div>
                      </div>

                      {selectedMember.is_minor && (
                        <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/30 border border-amber-500/30 text-amber-200 p-4 rounded-xl flex gap-3 backdrop-blur-sm">
                          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-400" />
                          <div>
                            <p className="font-semibold text-amber-300">Minor Patient Detected</p>
                            <p className="text-sm mt-1">Additional documents required: Birth Certificate and Parent's ID proof.</p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <UploadField name="hospitalBill" label="Hospital Bill" required disabled={exceedsCoverage} />
                        <UploadField name="pharmacyBill" label="Pharmacy Bill" disabled={exceedsCoverage} />

                        {/* Conditional Logic based on Minor/Adult */}
                        {selectedMember.is_minor ? (
                          <>
                            <UploadField name="birthCert" label="Birth Certificate" required disabled={exceedsCoverage} />
                            <UploadField name="aadhaar" label="Parent's Aadhaar" required disabled={exceedsCoverage} />
                            <UploadField name="pan" label="Parent's PAN Card" required disabled={exceedsCoverage} />
                          </>
                        ) : (
                          <>
                            <UploadField name="aadhaar" label="Aadhaar Card" required disabled={exceedsCoverage} />
                            <UploadField name="pan" label="PAN Card" disabled={exceedsCoverage} />
                          </>
                        )}
                      </div>
                      {exceedsCoverage && (
                        <div className="mt-4 rounded-lg bg-rose-900/20 border border-rose-600/30 p-3">
                          <p className="text-sm text-rose-300">Entered amount exceeds remaining policy coverage. Adjust the claim amount before uploading documents or submitting the claim.</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 hover:from-purple-600 hover:via-pink-600 hover:to-blue-600 text-white shadow-xl shadow-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 active:scale-95 rounded-xl border border-purple-400/20"
                    disabled={isSubmitting || !selectedMember || exceedsCoverage}
                  >
                    {isSubmitting ? (
                      <>
                        <UploadCloud className="w-5 h-5 mr-2 animate-pulse" />
                        Submitting Claim...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Submit Claim Request
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </Layout>
  );
}
