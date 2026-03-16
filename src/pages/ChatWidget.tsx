import { useState } from "react";
import { Send } from "lucide-react";
import reidLogo from "@/assets/REID_Base_Black.svg";

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
    <div className="flex items-center justify-center min-h-screen bg-transparent p-4">
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-center">
          <img src={reidLogo} alt="REID Base" className="h-5 opacity-60" />
        </div>
        <div className="relative flex items-end rounded-xl border border-border bg-card shadow-lg p-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Canggu, 2-bed villa, $350k"
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            style={{ minHeight: "40px", maxHeight: "120px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="flex-shrink-0 rounded-lg bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a href="https://realinfo.id" target="_blank" rel="noopener noreferrer" className="underline">
            REID
          </a>
        </p>
      </div>
    </div>
  );
}
