import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const navItems = [
  { href: "/student", label: "Dashboard" },
  { href: "/student/attendance", label: "Attendance" },
  { href: "/student/payments", label: "Payments" },
  { href: "/student/downloads", label: "Downloads" },
];

interface Props {
  children: ReactNode;
  title: string;
}

export function StudentLayout({ children, title }: Props) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  function handleLogout() {
    logoutMutation.mutate();
    queryClient.clear();
    logout();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Nav */}
      <header className="bg-sidebar border-b border-sidebar-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-6 h-14">
            {/* Logo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">II</span>
              </div>
              <span className="text-sm font-bold text-sidebar-foreground">IIECS-101</span>
            </div>

            {/* Nav */}
            <nav className="flex items-center gap-1 flex-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/student"
                    ? location === "/student"
                    : location.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-medium text-sidebar-foreground">{user?.name}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Page title bar */}
      <div className="bg-card border-b border-border px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
