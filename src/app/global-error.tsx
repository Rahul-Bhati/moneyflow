"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          gap: 16,
          padding: 40,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          Application error
        </h2>
        <p style={{ color: "#888", margin: 0 }}>
          {process.env.NODE_ENV !== "production" ? error.message : "Please refresh the page."}
        </p>
        <button
          onClick={reset}
          style={{
            padding: "10px 24px",
            borderRadius: 10,
            border: "none",
            background: "#3b82f6",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </body>
    </html>
  );
}
