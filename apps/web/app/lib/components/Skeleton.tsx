"use client";

import React from "react";

const skeletonStyles = `
@keyframes tp-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

/** A single shimmer block — use directly or compose with SkeletonRow / SkeletonTable */
export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 6,
  className,
  style,
}: SkeletonProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        width,
        height,
        borderRadius,
        background:
          "linear-gradient(90deg, var(--tp-gray-100) 25%, var(--tp-gray-200) 50%, var(--tp-gray-100) 75%)",
        backgroundSize: "200% 100%",
        animation: "tp-shimmer 1.8s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

/** A row of skeleton items — perfect for list/table skeletons */
export function SkeletonRow({
  columns = 4,
  height = 48,
}: {
  columns?: number;
  height?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 16,
        padding: "12px 0",
        borderBottom: "1px solid var(--tp-border)",
      }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          height={height === 48 ? (i === 0 ? 20 : 14) : height}
          width={i === 0 ? "70%" : `${50 + Math.random() * 30}%`}
        />
      ))}
    </div>
  );
}

/** Full-table skeleton — use for Contacts, Broadcasts, Templates etc. */
export function SkeletonTable({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      <style>{skeletonStyles}</style>
      <div style={{ padding: "0 4px" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} columns={columns} />
        ))}
      </div>
    </>
  );
}

/** Card-style skeleton — use for stat cards, analytics blocks */
export function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <>
      <style>{skeletonStyles}</style>
      <div
        style={{
          borderRadius: "var(--tp-radius-lg)",
          border: "1px solid var(--tp-border)",
          padding: 20,
          height,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "var(--tp-bg-primary)",
        }}
      >
        <Skeleton width="40%" height={12} />
        <Skeleton width="60%" height={28} />
        <Skeleton width="30%" height={10} />
      </div>
    </>
  );
}

/** Inbox conversation list skeleton */
export function SkeletonConversationList({ count = 8 }: { count?: number }) {
  return (
    <>
      <style>{skeletonStyles}</style>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 12,
            padding: "14px 16px",
            borderBottom: "1px solid var(--tp-border)",
            alignItems: "center",
          }}
        >
          <Skeleton width={40} height={40} borderRadius="50%" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Skeleton width="45%" height={14} />
              <Skeleton width="15%" height={10} />
            </div>
            <Skeleton width="70%" height={10} />
          </div>
        </div>
      ))}
    </>
  );
}

/** Analytics dashboard skeleton — stat cards grid */
export function SkeletonDashboard() {
  return (
    <>
      <style>{skeletonStyles}</style>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SkeletonCard height={260} />
        <SkeletonCard height={260} />
      </div>
    </>
  );
}
