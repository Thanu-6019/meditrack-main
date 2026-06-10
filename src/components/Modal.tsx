"use client";
import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  width?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: string;
  iconBg?: string;
}

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  width = 480,
  children,
  footer,
  icon,
  iconBg = "var(--brand-50)",
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* Trap scroll */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 600,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="anim-scale-in"
        style={{
          background: "var(--surface)",
          borderRadius: "var(--r-xl)",
          width: "100%",
          maxWidth: width,
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || icon) && (
          <div
            style={{
              padding: "24px 28px 20px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
            }}
          >
            {icon && (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: iconBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
            )}
            <div style={{ flex: 1 }}>
              {title && (
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 21,
                    color: "var(--n-900)",
                    letterSpacing: "-.02em",
                    lineHeight: 1.2,
                  }}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    marginTop: 3,
                    lineHeight: 1.5,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            <button
              className="btn btn-ghost btn-icon"
              onClick={onClose}
              aria-label="Close"
              style={{ flexShrink: 0, color: "var(--n-400)", fontSize: 18 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: "20px 28px", overflowY: "auto", flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: "16px 28px 24px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}