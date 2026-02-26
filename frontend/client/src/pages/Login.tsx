import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import AnimatedBackground from "@/components/AnimatedBackground";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsPending(true);
    try {
      const result = await authService.signIn(values.email, values.password);

      if (result.user) {
        // Get role from Supabase user metadata
        const userRole = result.user.user_metadata?.role || 'user';

        // Store auth data in localStorage for useAuth hook
        localStorage.setItem('mediclaim_auth_user_id', result.user.id);
        localStorage.setItem('mediclaim_auth_role', userRole);
        localStorage.setItem('mediclaim_auth_email', result.user.email || '');

        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });

        // Redirect based on role
        if (userRole === "admin") {
          setLocation("/admin");
        } else {
          setLocation("/portal");
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);

      let errorTitle = "Sign in failed";
      let errorMessage = "Invalid email or password.";

      // Check error type
      if (error.message?.includes("Email not confirmed")) {
        errorTitle = "Email not confirmed";
        errorMessage = "Please check your email and click the confirmation link before signing in.";
      } else if (error.message?.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password. If you just signed up, please check your email for a confirmation link.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      {/* Left Panel - Animated Background */}
      <AnimatedBackground />

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-[60%] bg-[#FDFBF7] flex items-center justify-center p-5 sm:p-6 md:p-8 lg:p-12 relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-full max-w-xl my-auto py-5 sm:py-8"
        >
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold tracking-tight text-[#111827] mb-3">
              Welcome Back
            </h1>
            <p className="text-base sm:text-lg text-[#6B7280] leading-relaxed">
              Sign in to access your medical claims dashboard
            </p>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#6B7280] mb-1.5 block">
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-0 top-3 h-5 w-5 text-[#6B7280]" />
                            <Input
                              type="email"
                              placeholder="you@company.com"
                              {...field}
                              className="h-14 text-base bg-transparent border-0 border-b-2 border-gray-200 focus-visible:ring-0 focus-visible:border-blue-500 pl-8 rounded-none transition-colors"
                            />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#6B7280] mb-1.5 block">
                        Password
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-0 top-3 h-5 w-5 text-[#6B7280]" />
                            <Input
                              type="password"
                              placeholder="Enter your password"
                              {...field}
                              className="h-14 text-base bg-transparent border-0 border-b-2 border-gray-200 focus-visible:ring-0 focus-visible:border-blue-500 pl-8 rounded-none transition-colors"
                            />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex items-center justify-end"
              >
                <button
                  type="button"
                  className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <Button
                  type="submit"
                  className="w-full h-14 rounded-full px-10 text-base font-semibold text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                  disabled={isPending}
                >
                  {isPending ? (
                    "Signing in..."
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Sign In
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
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-6 text-center"
          >
            <p className="text-base text-[#6B7280]">
              Don't have an account?{" "}
              <button
                onClick={() => setLocation("/signup")}
                className="font-semibold text-blue-500 hover:text-blue-600 transition-colors hover:underline"
              >
                Create Account
              </button>
            </p>
          </motion.div>

          {/* Security Badge */}
          <div className="mt-8 pt-6 border-t border-[#E5E7EB]">
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
