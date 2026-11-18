// The start of the app: index.html loads this file, and it draws the app into <div id="root">.
import "@fontsource-variable/readex-pro"; // the font (board D), served from our own files, Arabic and Latin
import "./app/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./app/routes";

createRoot(document.getElementById("root")!).render(
  // StrictMode runs extra checks while developing (never in the built site), to catch mistakes early.
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
