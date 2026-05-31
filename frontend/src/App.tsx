import { Routes, Route } from "react-router-dom";

function Home() {
  return (
    <div style={{ padding: 40, maxWidth: 800, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1>炒股学堂</h1>
      <p style={{ color: "#666" }}>不推荐股票，只教判断方法</p>
      <input
        type="text"
        placeholder="输入股票代码或名称搜索..."
        style={{
          width: "100%",
          padding: "12px 16px",
          fontSize: 16,
          border: "1px solid #ddd",
          borderRadius: 8,
          marginTop: 24,
        }}
      />
      <p style={{ marginTop: 8, fontSize: 14, color: "#999" }}>
        试试输入：000001（平安银行）、600519（贵州茅台）
      </p>
    </div>
  );
}

function StockPage() {
  return <div>个股教学页 — 开发中</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/stock/:code" element={<StockPage />} />
    </Routes>
  );
}
