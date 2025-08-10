import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation() as any;

  useEffect(() => {
    document.title = mode === "login" ? "Admin Login" : "Create Account";
  }, [mode]);

  useEffect(() => {
    const checkAndRedirect = async (session: any) => {
      if (!session) return;
      const { data, error } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
      if (data && !error) {
        const to = location.state?.from?.pathname || "/admin";
        navigate(to, { replace: true });
      } else {
        toast.error("Your account doesn't have admin access yet.");
        navigate("/", { replace: true });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      checkAndRedirect(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAndRedirect(session);
    });
    return () => subscription.unsubscribe();
  }, [navigate, location.state]);

  const canSubmit = useMemo(() => email.length > 3 && password.length >= 6, [email, password]);

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Logged in successfully");
  };

  const handleSignup = async () => {
    setLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Check your email to confirm your account");
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading">{mode === "login" ? "Admin Login" : "Create Account"}</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Sign in to access the admin portal."
              : "Create an account. An admin must grant access."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button onClick={mode === "login" ? handleLogin : handleSignup} disabled={!canSubmit || loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </Button>
          <div className="text-sm text-muted-foreground">
            {mode === "login" ? (
              <span>
                No account?{" "}
                <button className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("signup")}>
                  Sign up
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{" "}
                <button className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("login")}>
                  Sign in
                </button>
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Only users with the admin role can access the admin portal.
          </div>
          <div className="text-xs">
            <Link to="/" className="text-primary underline-offset-4 hover:underline">Back to site</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
