import { Route, Routes } from "react-router-dom";

import { AppBenchmark } from "./benchmark/AppBenchmark";
import { AppList } from "./list/AppList";

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<AppList />} />
      <Route path="benchmark" element={<AppBenchmark />} />
    </Routes>
  );
};
