import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

export default function NotFound() {
  const { user } = useAuth();
  const homeHref = user ? (user.role === "admin" ? "/admin" : "/student") : "/login";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        <div className="text-8xl font-black text-primary/20 mb-4 leading-none">404</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Page not found</h1>
        <p className="text-muted-foreground text-sm mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href={homeHref}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity text-sm"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
