import { useState } from "react";

const FULL_APP_URL = "https://ai.realinfo.id";

export default function ChatWidgetMinimal() {
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
        width: "100%",
        maxWidth: "500px",
        display: "flex",
        alignItems: "center",
        background: "transparent",
        padding: 0,
        margin: 0,
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          height: "50px",
          background: "transparent",
          borderRadius: "5px",
          border: "1px solid #d4d4d4",
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
          onClick={handleSubmit}
          disabled={!prompt.trim()}
          style={{
            flexShrink: 0,
            height: "36px",
            borderRadius: "5px",
            background: "hsl(36, 97%, 74%)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: prompt.trim() ? "pointer" : "default",
            transition: "background 0.2s",
            padding: "0 16px",
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
    </div>
  );
}
