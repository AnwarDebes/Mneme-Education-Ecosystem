"use client";

// Last-resort boundary: catches errors that happen in the root layout
// itself. Renders a minimal HTML page since the broken layout cannot.
interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b0b0d",
          color: "#f5f5f5",
        }}
      >
        <div style={{ maxWidth: 520, padding: 32 }}>
          <h1 style={{ marginTop: 0, fontSize: 28 }}>mneme could not render</h1>
          <p style={{ opacity: 0.8 }}>
            The root layout crashed. Your local data is untouched. Try reloading;
            if it persists, open devtools and copy the message below.
          </p>
          <pre style={{ overflow: "auto", background: "#19191c", padding: 12, borderRadius: 6, fontSize: 12 }}>
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #444",
              background: "#222",
              color: "white",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
