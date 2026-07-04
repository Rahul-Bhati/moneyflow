"use client";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 16,
        padding: 40,
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
        Something went wrong loading your data.
      </h2>
      <p style={{ color: "#888", margin: 0, maxWidth: 360 }}>
        {process.env.NODE_ENV !== "production" ? error.message : "Please try again. If this keeps happening, check that your Supabase project is active."}
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: "10px 24px",
          borderRadius: 10,
          border: "none",
          background: "#3b82f6",
          color: "#fff",
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
