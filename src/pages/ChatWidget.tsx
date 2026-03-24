import { useState } from "react";
import { TrendingUp, Globe, PieChart } from "lucide-react";

const FULL_APP_URL = "https://reidbase.lovable.app";

const quickButtons = [
  { label: "Trends", icon: TrendingUp, prompt: "What are the latest property market trends in Bali?" },
  { label: "Markets", icon: Globe, prompt: "Give me an overview of the current Bali property market" },
  { label: "Yield", icon: PieChart, prompt: "What are the current yield figures across Bali locations?" },
];

export default function ChatWidget() {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (text?: string) => {
    const trimmed = (text ?? prompt).trim();
    if (!trimmed) return;
    const encoded = encodeURIComponent(trimmed);
    window.open(`${FULL_APP_URL}/?prompt=${encoded}`, "_blank");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      style={{
        width: "500px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "transparent",
        padding: 0,
        margin: 0,
        gap: "10px",
      }}
    >
      {/* Prompt bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          height: "50px",
          background: "#ffffff",
          borderRadius: "5px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          padding: "0 6px 0 20px",
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Real data. Real answers"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "14px",
            color: "#1a1a1a",
            fontFamily: "Poppins, sans-serif",
            fontWeight: 200,
            height: "100%",
          }}
        />
        <button
          onClick={() => handleSubmit()}
          disabled={!prompt.trim()}
          style={{
            flexShrink: 0,
            height: "36px",
            borderRadius: "5px",
            background: prompt.trim() ? "hsl(36, 97%, 74%)" : "#e0d5c0",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: prompt.trim() ? "pointer" : "default",
            transition: "background 0.2s",
            padding: "0 16px",
            gap: "6px",
            fontFamily: "Poppins, sans-serif",
            fontWeight: 400,
            fontSize: "13px",
            color: "#1a1a1a",
          }}
        >
          Ask REID
        </button>
      </div>

      {/* Quick buttons */}
      <div style={{ display: "flex", gap: "8px", alignSelf: "flex-start" }}>
        {quickButtons.map((btn) => (
          <button
            key={btn.label}
            onClick={() => handleSubmit(btn.prompt)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "3px",
              border: "none",
              background: "#FFE3BB",
              color: "hsl(36, 97%, 44%)",
              fontSize: "12px",
              fontFamily: "Poppins, sans-serif",
              fontWeight: 700,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f5d49a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFE3BB")}
          >
            <btn.icon style={{ width: "14px", height: "14px" }} />
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
