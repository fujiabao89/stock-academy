import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Learn from "./pages/Learn";
import PatternDetailPage from "./pages/PatternDetailPage";
import GlossaryPage from "./pages/GlossaryPage";
import StockDetail from "./pages/StockDetail";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import NewsPage from "./pages/NewsPage";
import WatchlistPage from "./pages/WatchlistPage";
import StrategiesPage from "./pages/StrategiesPage";
import StrategyDetailPage from "./pages/StrategyDetailPage";
import StrategyFormPage from "./pages/StrategyFormPage";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/stock/:code" element={<StockDetail />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/patterns/:patternId" element={<PatternDetailPage />} />
        <Route path="/learn/glossary" element={<GlossaryPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/watchlist" element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} />
        <Route path="/strategies" element={<StrategiesPage />} />
        <Route path="/strategies/:id" element={<StrategyDetailPage />} />
        <Route path="/strategies/new" element={<ProtectedRoute><StrategyFormPage /></ProtectedRoute>} />
        <Route path="/strategies/:id/edit" element={<ProtectedRoute><StrategyFormPage /></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
