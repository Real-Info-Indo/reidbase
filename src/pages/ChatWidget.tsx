import { useState } from "react";
import { TrendingUp, BarChart3, Calculator } from "lucide-react";

const FULL_APP_URL = "https://ai.realinfo.id";

const quickButtons = [
  { label: "Trends", icon: TrendingUp, prompt: "What are the latest property market trends in Bali?" },
  { label: "Markets", icon: BarChart3, prompt: "Give me an overview of the current Bali property market" },
  { label: "Yield", icon: Calculator, prompt: "What are the current yield figures across Bali locations?" },
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
        width: "100%",
        maxWidth: "500px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "transparent",
        padding: 0,
        margin: 0,
        gap: "10px",
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Prompt bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          height: "50px",
          background: "transparent",
          gap: "8px",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            height: "100%",
            background: "#ffffff",
            borderRadius: "5px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            padding: "0 16px",
          }}
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Real data. Real answers"
            style={{
              flex: 1,
              minWidth: 0,
              width: 0,
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
        </div>
        <button
          onClick={() => handleSubmit()}
          disabled={!prompt.trim()}
          style={{
            flexShrink: 0,
            height: "100%",
            borderRadius: "5px",
            background: "hsl(36, 97%, 74%)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: prompt.trim() ? "pointer" : "default",
            transition: "background 0.2s",
            padding: "0 18px",
            gap: "6px",
            fontFamily: "Poppins, sans-serif",
            fontWeight: 500,
            fontSize: "13px",
            color: "#1a1a1a",
          }}
        >
          Ask REID
        </button>
      </div>

      {/* Quick buttons */}
      <div style={{ display: "flex", gap: "8px", alignSelf: "flex-start", flexWrap: "wrap", width: "100%" }}>
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
              background: "#e8e8e8",
              color: "#555",
              fontSize: "12px",
              fontFamily: "Poppins, sans-serif",
              fontWeight: 300,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#d9d9d9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#e8e8e8")}
          >
            <btn.icon style={{ width: "14px", height: "14px" }} />
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
