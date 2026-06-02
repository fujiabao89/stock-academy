import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Learn from "./pages/Learn";
import PatternDetailPage from "./pages/PatternDetailPage";
import GlossaryPage from "./pages/GlossaryPage";
import StockDetail from "./pages/StockDetail";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/stock/:code" element={<StockDetail />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/patterns/:patternId" element={<PatternDetailPage />} />
        <Route path="/learn/glossary" element={<GlossaryPage />} />
      </Route>
    </Routes>
  );
}
