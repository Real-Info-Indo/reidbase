import { useState } from "react";
import { ArrowRight, TrendingUp, MapPin, BarChart3, Calculator } from "lucide-react";

const suggestions = [
  { title: "Market trends", desc: "Explore current real estate market dynamics across Bali", icon: TrendingUp },
  { title: "Top markets", desc: "Discover the highest performing investment locations", icon: BarChart3 },
  { title: "Emerging locations", desc: "Find up-and-coming areas with growth potential", icon: MapPin },
  { title: "Yield estimator", desc: "Calculate expected returns on property investments", icon: Calculator },
];

export default function NewAnalysis() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);

  const handleSubmit = () => {
    if (!query.trim()) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", text: query },
      { role: "ai", text: "I'd be happy to help you explore that topic. This is a placeholder response — AI integration will be available in Phase 2." },
    ]);
    setQuery("");
  };

  const hasConversation = messages.length > 0;

  return (
    <div className="flex flex-col h-screen">
      {hasConversation && (
        <div className="border-b border-border px-8 py-3">
          <span className="text-sm font-medium text-muted-foreground">Conversation name ▾</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-12">
        {!hasConversation ? (
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-semibold mb-2">
              Welcome to <span className="text-primary">REID</span>,
            </h1>
            <p className="text-2xl text-muted-foreground mb-10">what would you like to discover?</p>

            {/* Input area */}
            <div className="relative mb-12">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSubmit())}
                placeholder="Ask about Bali real estate markets, trends, yields..."
                className="w-full min-h-[120px] rounded-xl border border-border bg-card p-5 pr-14 text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
              />
              <button
                onClick={handleSubmit}
                className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            {/* Suggestion cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {suggestions.map((s) => (
                <button
                  key={s.title}
                  onClick={() => { setQuery(s.title); }}
                  className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left hover:border-primary/40 hover:shadow-sm transition-all group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium mb-1">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 mt-1 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-border rounded-bl-md"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom input bar (visible when in conversation) */}
      {hasConversation && (
        <div className="border-t border-border px-8 py-4">
          <div className="max-w-3xl mx-auto relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Ask a follow-up question..."
              className="w-full rounded-xl border border-border bg-card px-5 py-3 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={handleSubmit}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
