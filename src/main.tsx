import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";

import { ThemeSync } from "@/app/components/layout/ThemeSync";
import { router } from "@/app/router";
import { AppUiProvider } from "@/app/state/appUi";
import "@/styles/parity-keyframes.css";
import "@/styles/parity-tokens.css";
import "@/styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      networkMode: "always",
    },
  },
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}
const rootElement = root;

function bootstrap() {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppUiProvider>
          <ThemeSync />
          <RouterProvider router={router} />
        </AppUiProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

bootstrap();
