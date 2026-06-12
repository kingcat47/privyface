import { createRoot } from "react-dom/client";
import Router from "./router";
import { RouterProvider } from "react-router-dom";

createRoot(document.getElementById("root")!).render(
  <RouterProvider router={Router} />
);
