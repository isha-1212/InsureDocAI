import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-users";

import Login from "@/pages/Login";
import SignUp from "@/pages/SignUp";
import UserDashboard from "@/pages/UserDashboard";
import FamilyMembers from "@/pages/FamilyMembers";
import NewClaim from "@/pages/NewClaim";
import AdminDashboard from "@/pages/AdminDashboard";
import PolicyReview from "@/pages/PolicyReview";
import PolicyDetail from "@/pages/PolicyDetail";
import ClaimProcessing from "@/pages/ClaimProcessing";
import ClaimReviewPage from "@/pages/ClaimReviewPage";
import AdminClaimReview from "@/pages/AdminClaimReview";
import ClaimProcessingNew from "@/pages/ClaimProcessingNew";
import AuthTest from "@/pages/AuthTest";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function ProtectedRoute({
  component: Component,
  allowedRole
}: {
  component: React.ComponentType,
  allowedRole?: 'user' | 'admin'
}) {
  const { session, role, isLoading } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!session) {
      setLocation("/login");
      return;
    }

    if (allowedRole && role !== allowedRole) {
      setLocation(role === 'admin' ? '/admin' : '/portal');
    }
  }, [session, role, isLoading, setLocation, allowedRole]);

  if (isLoading) return null;
  if (!session) return null;
  if (allowedRole && role !== allowedRole) return null;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={SignUp} />

      <Route path="/auth-test" component={AuthTest} />

      <Route path="/portal">
        {() => <ProtectedRoute component={UserDashboard} allowedRole="user" />}
      </Route>
      <Route path="/portal/members">
        {() => <ProtectedRoute component={FamilyMembers} allowedRole="user" />}
      </Route>
      <Route path="/portal/claims">
        {() => <ProtectedRoute component={UserDashboard} allowedRole="user" />}
      </Route>
      <Route path="/portal/claims/new">
        {() => <ProtectedRoute component={NewClaim} allowedRole="user" />}
      </Route>

      <Route path="/admin">
        {() => <ProtectedRoute component={AdminDashboard} allowedRole="admin" />}
      </Route>
      <Route path="/admin/policies">
        {() => <ProtectedRoute component={PolicyReview} allowedRole="admin" />}
      </Route>
      <Route path="/admin/policies/:id">
        {() => <ProtectedRoute component={PolicyDetail} allowedRole="admin" />}
      </Route>
      <Route path="/admin/claims">
        {() => <ProtectedRoute component={ClaimProcessing} allowedRole="admin" />}
      </Route>
      <Route path="/admin/claims/review/:claimId">
        {() => <ProtectedRoute component={AdminClaimReview} allowedRole="admin" />}
      </Route>
      <Route path="/admin/claims/process">
        {() => <ProtectedRoute component={ClaimProcessingNew} allowedRole="admin" />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
