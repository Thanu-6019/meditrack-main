"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Props { title: string; subtitle?: string; actions?: React.ReactNode; }

export default function Topbar({ title, subtitle, actions }: Props) {
  const [user, setUser] = useState<any>(null);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const userRes = await fetch("/api/auth/me");
        const userData = await userRes.json();
        if (userData.success && userData.data?.user) {
          setUser(userData.data.user);
        }

        const notifsRes = await fetch("/api/notifications");
        const notifsData = await notifsRes.json();
        if (notifsData.success) {
          const count = notifsData.data.unreadCount || 0;
          setHasUnread(count > 0);
        }
      } catch (err) {
        console.error("Topbar data load error", err);
      }
    }
    loadData();
  }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const initials = user?.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "ME";

  return (
    <>
      {/* Sticky bar */}
      <div className="topbar">
        <div className="topbar-date">
          <span className="live-dot" />
          {dateStr}
        </div>
        <div className="topbar-actions">
          <Link href="/notifications">
            <button className="btn btn-ghost btn-icon" style={{ position: "relative" }} aria-label="Notifications">
              🔔
              {hasUnread && (
                <span style={{
                  position: "absolute", top: 5, right: 5,
                  width: 8, height: 8, borderRadius: "50%",
                  background: "var(--danger)", border: "1.5px solid white",
                }} />
              )}
            </button>
          </Link>
          <Link href="/profile">
            <div className="avatar" style={{ width: 34, height: 34, cursor: "pointer", fontSize: 12 }}>
              {initials}
            </div>
          </Link>
        </div>
      </div>

      {/* Page header */}
      <div className="page-hd anim-fade-up">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
        {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
      </div>
    </>
  );
}