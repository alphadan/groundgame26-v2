// src/index.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";

// === Global Error Boundary (Catches unhandled exceptions) ===
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error in root boundary:", error, errorInfo);
    // Optional: send to error reporting service (Sentry, LogRocket, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            color: "#333",
          }}
        >
          <h1>Something went wrong</h1>
          <p>
            We encountered an unexpected error while loading the application.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              background: "#B22234",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// === Query Client ===
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  },
});

// === Safe Root Mounting ===
const rootElement = document.getElementById("root");

if (!rootElement) {
  // This should never happen in correct setup, but we guard anyway
  document.body.innerHTML = `
    <div style="padding:40px;text-align:center;font-family:system-ui,sans-serif;">
      <h1>Application Error</h1>
      <p>Root element not found. Please check public/index.html contains &lt;div id="root"&gt;&lt;/div&gt;</p>
    </div>
  `;
  throw new Error("Root element #root not found in DOM");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </RootErrorBoundary>
  </React.StrictMode>
);
