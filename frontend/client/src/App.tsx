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

// Protected Route Component
function ProtectedRoute({
  component: Component,
  allowedRole
}: {
  component: React.ComponentType,
  allowedRole?: 'user' | 'admin'
}) {
  const { userId, role } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (!userId) {
      setLocation("/");
    } else if (allowedRole && role !== allowedRole) {
      // Redirect to correct dashboard if trying to access wrong role page
      setLocation(role === 'admin' ? '/admin' : '/portal');
    }
  }, [userId, role, setLocation, allowedRole]);

  if (!userId) return null;
  if (allowedRole && role !== allowedRole) return null;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={SignUp} />

      {/* Auth Test Page */}
      <Route path="/auth-test" component={AuthTest} />

      {/* User Portal Routes */}
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

      {/* Admin Portal Routes */}
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
