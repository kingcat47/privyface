import { createBrowserRouter } from "react-router-dom";
import { Home } from "./pages/Home";
import { FaceScan } from "./pages/FaceScan";

const Router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/face-scan",
    element: <FaceScan />,
  },
]);

export default Router;
