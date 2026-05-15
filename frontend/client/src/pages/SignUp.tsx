import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ShieldCheck, User, Mail, Lock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { authService } from "@/lib/auth";
import { supabase, API_URL } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import AnimatedBackground from "@/components/AnimatedBackground";

const signUpSchema = z.object({
    fullName: z.string().min(3, "Full name must be at least 3 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["user", "admin"]),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

export default function SignUp() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [isPending, setIsPending] = useState(false);

    const form = useForm<z.infer<typeof signUpSchema>>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            fullName: "",
            email: "",
            password: "",
            confirmPassword: "",
            role: "user",
        },
    });

    async function onSubmit(values: z.infer<typeof signUpSchema>) {
        setIsPending(true);
        try {
            // Step 1: Sign up with Supabase (save full name in user metadata)
            const result = await authService.signUp(values.email, values.password, values.role, values.fullName);

            if (result.user) {
                // Step 2: Register in Django to enforce unique email constraint
                const registerResponse = await fetch(`${API_URL}/api/users/users/register/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        supabase_user_id: result.user.id,
                        email: values.email,
                        role: values.role,
                        full_name: values.fullName
                    })
                });

                // Check if user already exists in Django (409 Conflict)
                if (registerResponse.status === 409) {
                    const error = await registerResponse.json();
                    toast({
                        title: "User already exists",
                        description: error.detail || "An account with this email already exists. Redirecting to sign in...",
                        variant: "destructive",
                    });
                    setTimeout(() => setLocation("/login"), 2000);
                    return;
                }

                if (!registerResponse.ok) {
                    const error = await registerResponse.json();
                    throw new Error(error.detail || 'Failed to complete registration');
                }

                // Success - user created in both Supabase and Django
                toast({
                    title: "Account created successfully!",
                    description: "You can now sign in with your credentials.",
                });
                setTimeout(() => setLocation("/login"), 2000);
            }
        } catch (error: any) {
            console.log('Signup error:', error);
            const exactError = [
                error?.message,
                error?.code ? `code=${error.code}` : null,
                typeof error?.status === 'number' ? `status=${error.status}` : null,
            ].filter(Boolean).join(' | ');

            // Check if user already exists
            if (error.name === 'UserExistsError' ||
                error.message?.toLowerCase().includes("already") ||
                error.message?.toLowerCase().includes("exists") ||
                error.code === "user_already_exists" ||
                error.status === 422) {
                toast({
                    title: "User already exists",
                    description: exactError || "An account with this email already exists. Redirecting to sign in...",
                    variant: "destructive",
                });
                setTimeout(() => setLocation("/login"), 2000);
            } else {
                toast({
                    title: "Sign up failed",
                    description: exactError || "An error occurred during sign up. Please try again.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsPending(false);
        }
    }

    return (
        <div className="min-h-screen lg:h-screen w-full flex flex-col lg:flex-row overflow-x-hidden lg:overflow-hidden">
            {/* Left Panel - Animated Background */}
            <AnimatedBackground />

            {/* Right Panel - Auth Form */}
            <div className="w-full lg:w-[60%] bg-[#FDFBF7] flex items-center justify-center px-5 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7 lg:px-7 lg:py-4 relative overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="w-full max-w-md my-auto py-1 sm:py-3 lg:py-0"
                >
                    {/* Header */}
                    <div className="mb-3 sm:mb-4">
                        <h1 className="text-4xl sm:text-[3.6rem] lg:text-[3.25rem] font-serif font-bold tracking-tight text-[#111827] mb-1.5">
                            Create Account
                        </h1>
                        <p className="text-[0.98rem] lg:text-base text-[#6B7280] leading-relaxed">
                            Join InsureDoc AI for intelligent claim processing
                        </p>
                    </div>

                    {/* Form */}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                            {/* Role Selection */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.5 }}
                            >
                                <FormField
                                    control={form.control}
                                    name="role"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="text-[0.92rem] font-medium text-[#6B7280] mb-1 block">
                                                Select Role
                                            </FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                    className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                                                >
                                                    <FormItem className="relative">
                                                        <FormControl>
                                                            <RadioGroupItem value="user" id="role-user" className="peer sr-only" />
                                                        </FormControl>
                                                        <Label
                                                            htmlFor="role-user"
                                                            className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border-2 border-[#E5E7EB] bg-white p-3 hover:border-blue-500/30 hover:bg-blue-50 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50 cursor-pointer transition-all"
                                                        >
                                                            <User className="mb-1 h-5 w-5 text-[#6B7280] peer-data-[state=checked]:text-blue-500" />
                                                            <span className="text-[0.92rem] font-semibold text-[#111827]">Policy Holder</span>
                                                        </Label>
                                                    </FormItem>
                                                    <FormItem className="relative">
                                                        <FormControl>
                                                            <RadioGroupItem value="admin" id="role-admin" className="peer sr-only" />
                                                        </FormControl>
                                                        <Label
                                                            htmlFor="role-admin"
                                                            className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border-2 border-[#E5E7EB] bg-white p-3 hover:border-blue-500/30 hover:bg-blue-50 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50 cursor-pointer transition-all"
                                                        >
                                                            <ShieldCheck className="mb-1 h-5 w-5 text-[#6B7280] peer-data-[state=checked]:text-blue-500" />
                                                            <span className="text-[0.92rem] font-semibold text-[#111827]">Administrator</span>
                                                        </Label>
                                                    </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </motion.div>

                            {/* Full Name Field */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                            >
                                <FormField
                                    control={form.control}
                                    name="fullName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[0.92rem] font-medium text-[#6B7280] mb-1 block">
                                                Full Name
                                            </FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <User className="absolute left-0 top-3 h-4 w-4 text-[#6B7280]" />
                                                    <Input
                                                        type="text"
                                                        placeholder="John Doe"
                                                        {...field}
                                                        className="h-10 text-[0.95rem] bg-transparent border-0 border-b-2 border-gray-200 focus-visible:ring-0 focus-visible:border-blue-500 pl-7 rounded-none transition-colors"
                                                        autoComplete="name"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </motion.div>

                            {/* Email Field */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3, duration: 0.5 }}
                            >
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[0.92rem] font-medium text-[#6B7280] mb-1 block">
                                                Email Address
                                            </FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Mail className="absolute left-0 top-3 h-4 w-4 text-[#6B7280]" />
                                                    <Input
                                                        type="email"
                                                        placeholder="you@company.com"
                                                        {...field}
                                                        className="h-10 text-[0.95rem] bg-transparent border-0 border-b-2 border-gray-200 focus-visible:ring-0 focus-visible:border-blue-500 pl-7 rounded-none transition-colors"
                                                        autoComplete="email"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </motion.div>

                            {/* Password Field */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4, duration: 0.5 }}
                            >
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[0.92rem] font-medium text-[#6B7280] mb-1 block">
                                                Password
                                            </FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Lock className="absolute left-0 top-3 h-4 w-4 text-[#6B7280]" />
                                                    <Input
                                                        type="password"
                                                        placeholder="Min 6 characters"
                                                        {...field}
                                                        className="h-10 text-[0.95rem] bg-transparent border-0 border-b-2 border-gray-200 focus-visible:ring-0 focus-visible:border-blue-500 pl-7 rounded-none transition-colors"
                                                        autoComplete="new-password"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </motion.div>

                            {/* Confirm Password Field */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5, duration: 0.5 }}
                            >
                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[0.92rem] font-medium text-[#6B7280] mb-1 block">
                                                Confirm Password
                                            </FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Lock className="absolute left-0 top-3 h-4 w-4 text-[#6B7280]" />
                                                    <Input
                                                        type="password"
                                                        placeholder="Confirm your password"
                                                        {...field}
                                                        className="h-10 text-[0.95rem] bg-transparent border-0 border-b-2 border-gray-200 focus-visible:ring-0 focus-visible:border-blue-500 pl-7 rounded-none transition-colors"
                                                        autoComplete="new-password"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6, duration: 0.5 }}
                            >
                                <Button
                                    type="submit"
                                    className="w-full h-10 rounded-full px-8 text-[0.95rem] font-semibold text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 mt-0.5"
                                    disabled={isPending}
                                >
                                    {isPending ? (
                                        "Creating account..."
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            Create Account
                                            <ArrowRight className="w-4 h-4" />
                                        </span>
                                    )}
                                </Button>
                            </motion.div>
                        </form>
                    </Form>

                    {/* Footer */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7, duration: 0.5 }}
                        className="mt-2.5 text-center"
                    >
                        <p className="text-[0.92rem] text-[#6B7280]">
                            Already have an account?{" "}
                            <button
                                onClick={() => setLocation("/login")}
                                className="font-semibold text-blue-500 hover:text-blue-600 transition-colors hover:underline"
                            >
                                Sign In
                            </button>
                        </p>
                    </motion.div>

                    {/* Security Badge */}
                    <div className="mt-3 pt-2.5 border-t border-[#E5E7EB]">
                        <div className="flex items-center justify-center gap-2 text-xs text-[#6B7280]">
                            <Lock className="w-3 h-3" />
                            <span className="font-mono tracking-wide">256-bit SSL Encrypted</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
