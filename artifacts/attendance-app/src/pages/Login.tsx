import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    console.log('Attempting login with email:', email.trim());
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    loginMutation.mutate(
      { data: { email: email.trim() } },
      {
        onSuccess: (data) => {
          console.log('Login succeeded with data:', data);
          login({
            email: data.email,
            role: data.role as "admin" | "student",
            studentId: data.studentId,
            name: data.name,
          });
          setLocation(data.role === "admin" ? "/admin" : "/student");
          console.log('Redirected to', data.role === "admin" ? "/admin" : "/student");
        },
        onError: (error) => {
          console.error('Login error:', error);
          setError("Email not recognized. Please contact your administrator.");
        },
      },
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg">
            <span className="text-primary-foreground font-black text-xl">II</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">IIECS-101</h1>
          <p className="text-muted-foreground text-sm mt-1">Attendance &amp; Invoice System</p>
          <p className="text-xs text-muted-foreground mt-1 opacity-70">Batch B — C/C++ Algorithms</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-xl">
          <h2 className="text-base font-semibold text-foreground mb-1">Sign in</h2>
          <p className="text-xs text-muted-foreground mb-5">Enter your institutional email address</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@iiecs.edu"
                className="w-full px-3 py-2.5 rounded-md bg-background border border-input text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                disabled={loginMutation.isPending}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-md text-sm hover:opacity-90 active:opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginMutation.isPending ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Admin: <span className="text-foreground">admin@iiecs.edu</span>
            </p>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Students: use your registered email
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 opacity-50">
          IIECS Institute — Academic Management System
        </p>
      </div>
    </div>
  );
}
