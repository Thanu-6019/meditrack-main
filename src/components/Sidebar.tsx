"use client";
// src/components/Sidebar.tsx
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Sidebar() {
  const path   = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [activeMedsCount, setActiveMedsCount] = useState(0);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const userRes = await fetch("/api/auth/me");
        const userData = await userRes.json();
        if (userData.success && userData.data?.user) {
          setUser(userData.data.user);
        }

        const medsRes = await fetch("/api/medicines");
        const medsData = await medsRes.json();
        if (medsData.success) {
          const list = medsData.data.medicines || [];
          setActiveMedsCount(list.filter((m: any) => m.status === "active").length);
        }

        const notifsRes = await fetch("/api/notifications");
        const notifsData = await notifsRes.json();
        if (notifsData.success) {
          setUnreadNotifsCount(notifsData.data.unreadCount || 0);
        }
      } catch (err) {
        console.error("Sidebar data load error", err);
      }
    }
    loadData();
  }, [path]); // Reload when pathname changes to keep badges in sync

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      // Always redirect to login, even if the fetch fails for some reason.
      router.push("/login");
    }
  }

  const mainNav = [
    { href: "/dashboard",       icon: "⊞", label: "Dashboard" },
    { href: "/medicines",       icon: "💊", label: "Medicines",     badge: activeMedsCount || null },
    { href: "/health-metrics",  icon: "📊", label: "Health Metrics" },
    { href: "/ai-assistant",    icon: "✦",  label: "AI Assistant" },
    { href: "/scanner",         icon: "⬡",  label: "Scanner" },
    { href: "/notifications",   icon: "🔔", label: "Notifications", badge: unreadNotifsCount || null },
  ];

  const accountNav = [
    { href: "/profile", icon: "◉", label: "Profile" },
  ];

  const healthScore = user?.healthScore || 85;
  const name = user?.name || "Patient";
  const initials = user?.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "ME";

  return (
    <aside className="sidebar anim-slide-in">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">✚</div>
        <span className="logo-name">Medi<em>Track</em></span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-group-lbl">Overview</div>
        {mainNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${path === item.href ? "active" : ""}`}
          >
            <span className="nav-icon-wrap">{item.icon}</span>
            <span>{item.label}</span>
            {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
          </Link>
        ))}

        <div className="nav-group-lbl" style={{ marginTop: 14 }}>Account</div>
        {accountNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${path === item.href ? "active" : ""}`}
          >
            <span className="nav-icon-wrap">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Health score widget */}
      <div className="sidebar-score">
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: ".08em", opacity: .7, marginBottom: 8,
        }}>
          Health Score
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 1 }}>
            {healthScore}
          </span>
          <span style={{ fontSize: 12, opacity: .7 }}>/100 · Excellent</span>
        </div>
        <div className="progress" style={{ height: 5 }}>
          <div
            className="progress-bar"
            style={{ width: `${healthScore}%`, background: "rgba(255,255,255,.8)" }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="nav-link" style={{ gap: 10, padding: "10px" }}>
          <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: "var(--n-800)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {name}
            </div>
            <div style={{ fontSize: 11, color: "var(--n-400)" }}>Patient</div>
          </div>
        </div>

        {/* Sign out — calls the API to clear the HTTP-only cookie */}
        <button
          onClick={handleSignOut}
          className="nav-link"
          style={{ color: "var(--danger)", marginTop: 2, width: "100%", background: "none", border: "none", cursor: "pointer" }}
        >
          <span className="nav-icon-wrap">⏻</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}