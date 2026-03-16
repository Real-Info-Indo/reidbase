import { useState } from "react";
import { ArrowRight } from "lucide-react";

const FULL_APP_URL = "https://reidbase.lovable.app";

export default function ChatWidget() {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    const trimmed = prompt.trim();
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
        height: "50px",
        display: "flex",
        alignItems: "center",
        background: "transparent",
        padding: 0,
        margin: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          height: "100%",
          background: "#ffffff",
          borderRadius: "9999px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          padding: "0 6px 0 20px",
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Canggu, 2-bed villa, $350k"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "14px",
            color: "#1a1a1a",
            height: "100%",
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim()}
          style={{
            flexShrink: 0,
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: prompt.trim() ? "#e8a838" : "#e0d5c0",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: prompt.trim() ? "pointer" : "default",
            transition: "background 0.2s",
          }}
        >
          <ArrowRight style={{ width: "18px", height: "18px", color: "#1a1a1a" }} />
        </button>
      </div>
    </div>
  );
}
