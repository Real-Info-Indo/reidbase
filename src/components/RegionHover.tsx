import React from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
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

export function RegionHover({ name }: { name: string }) {
  const key = name === "Bukit" ? "South Badung (Bukit)" : name;
  const img = REGION_IMAGES[key] || REGION_IMAGES[name];
  if (!img) return <>{name}</>;
  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>
        <span className="underline decoration-dotted decoration-primary/60 underline-offset-2 cursor-help">
          {name}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        className="w-72 p-2 bg-card/95 backdrop-blur border-border shadow-lg"
      >
        <img
          src={img}
          alt={`${key} region map`}
          className="w-full h-auto rounded-sm"
        />
        <div className="mt-1 text-xs font-medium text-foreground text-center">
          {key}
        </div>
      </HoverCardContent>
    </HoverCard>
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
