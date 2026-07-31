"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          padding: "2rem",
          textAlign: "center",
          background: "#e8eaef",
          color: "#1a1d24",
        }}
      >
        <p
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#6bbf2a",
            fontWeight: 700,
            marginBottom: "0.75rem",
          }}
        >
          Error
        </p>
        <h1
          style={{
            fontSize: "1.5rem",
            marginBottom: "0.5rem",
            fontWeight: 700,
          }}
        >
          Something went wrong
        </h1>
        <p style={{ color: "#5c6370", marginBottom: "1.5rem", maxWidth: 360 }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: "0.65rem 1.25rem",
            borderRadius: "0.625rem",
            border: "none",
            background: "#6bbf2a",
            color: "#142008",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          Try again
        </button>
        {error?.digest ? (
          <p
            style={{
              marginTop: "1.5rem",
              fontSize: "0.7rem",
              color: "#8a919c",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  );
}
