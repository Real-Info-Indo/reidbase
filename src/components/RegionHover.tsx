import React from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Maximize2 } from "lucide-react";
import centralBadung from "@/assets/regions/central-badung.png";
import denpasar from "@/assets/regions/denpasar.png";
import gianyar from "@/assets/regions/gianyar.png";
import mengwi from "@/assets/regions/mengwi.png";
import northBadung from "@/assets/regions/north-badung.png";
import southBadung from "@/assets/regions/south-badung.png";
import tabanan from "@/assets/regions/tabanan.png";

// Map of canonical region name -> image
const REGION_IMAGES: Record<string, string> = {
  "Central Badung": centralBadung,
  "Denpasar": denpasar,
  "Gianyar": gianyar,
  "Mengwi": mengwi,
  "North Badung": northBadung,
  "South Badung": southBadung,
  "South Badung (Bukit)": southBadung,
  "Bukit": southBadung,
  "Tabanan": tabanan,
};

// Order matters: longer/multi-word names first to win in regex
const REGION_NAMES = [
  "South Badung (Bukit)",
  "Central Badung",
  "North Badung",
  "South Badung",
  "Denpasar",
  "Gianyar",
  "Mengwi",
  "Tabanan",
  "Bukit",
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const REGION_REGEX = new RegExp(
  `\\b(${REGION_NAMES.map(escapeRegex).join("|")})\\b`,
  "g",
);

// Preload all region images once on module load so the hover popover
// shows instantly without a network round-trip on first hover.
if (typeof window !== "undefined") {
  Object.values(REGION_IMAGES).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

export function RegionHover({ name }: { name: string }) {
  const key = name === "Bukit" ? "South Badung (Bukit)" : name;
  const img = REGION_IMAGES[key] || REGION_IMAGES[name];
  const [expanded, setExpanded] = React.useState(false);
  if (!img) return <>{name}</>;
  return (
    <>
      <HoverCard openDelay={60} closeDelay={40}>
        <HoverCardTrigger asChild>
          <span className="underline decoration-solid decoration-primary decoration-2 underline-offset-2 cursor-help">
            {name}
          </span>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="center"
          className="w-72 p-2 bg-card/95 backdrop-blur border-border shadow-lg"
        >
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="relative block w-full group"
            aria-label={`Expand ${key} map`}
          >
            <img
              src={img}
              alt={`${key} region map`}
              loading="eager"
              decoding="sync"
              className="w-full h-auto rounded-sm"
            />
            <span className="absolute top-1 right-1 rounded-sm bg-background/80 backdrop-blur p-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="h-3.5 w-3.5 text-foreground" />
            </span>
          </button>
          <div className="mt-1 text-xs font-medium text-foreground text-center">
            Click to enlarge
          </div>
        </HoverCardContent>
      </HoverCard>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-3xl p-4 bg-card/95 backdrop-blur">
          <DialogTitle className="text-sm font-medium text-foreground text-center">
            {key}
          </DialogTitle>
          <img
            src={img}
            alt={`${key} region map enlarged`}
            className="w-full h-auto rounded-sm"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Walks a React children tree and replaces region name occurrences in
 * text nodes with <RegionHover> components.
 */
export function injectRegionHovers(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child, idx) => {
    if (typeof child === "string") {
      return processString(child, `s-${idx}`);
    }
    if (React.isValidElement(child)) {
      // Don't recurse into our own hover or anchor/code elements
      const type = child.type as any;
      if (type === RegionHover) return child;
      const tag = typeof type === "string" ? type : "";
      if (tag === "a" || tag === "code") return child;
      const childProps: any = child.props || {};
      if (childProps.children == null) return child;
      return React.cloneElement(
        child,
        { key: child.key ?? `c-${idx}` },
        injectRegionHovers(childProps.children),
      );
    }
    return child;
  });
}

function processString(text: string, keyPrefix: string): React.ReactNode {
  REGION_REGEX.lastIndex = 0;
  if (!REGION_REGEX.test(text)) return text;
  REGION_REGEX.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = REGION_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <RegionHover key={`${keyPrefix}-r-${i++}`} name={match[0]} />,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}
