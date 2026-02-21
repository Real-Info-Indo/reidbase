import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useTier, tierLabels } from "@/contexts/TierContext";
import { User, Palette } from "lucide-react";

interface PersonalisationData {
  nickname: string;
  occupation: string;
  business: string;
  about: string;
}

const STORAGE_KEY = "reid-personalisation";

function loadPersonalisation(): PersonalisationData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { nickname: "", occupation: "", business: "", about: "" };
}

function savePersonalisation(data: PersonalisationData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { tier, userName } = useTier();
  const [activeTab, setActiveTab] = useState<"account" | "personalisation">("account");
  const [personalisation, setPersonalisation] = useState<PersonalisationData>(loadPersonalisation);

  useEffect(() => {
    if (open) {
      setPersonalisation(loadPersonalisation());
    }
  }, [open]);

  const handleSave = () => {
    savePersonalisation(personalisation);
    onOpenChange(false);
  };

  const tabs = [
    { id: "account" as const, label: "Account", icon: User },
    { id: "personalisation" as const, label: "Personalisation", icon: Palette },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-lg font-bold">Settings</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 px-6 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-extralight border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {activeTab === "account" && (
            <>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-name">Name</Label>
                  <Input id="settings-name" value={userName} disabled className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-email">Email</Label>
                  <Input id="settings-email" placeholder="your@email.com" disabled className="bg-muted" />
                </div>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label>Plan &amp; Details</Label>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <span className="inline-block text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary px-2.5 py-1 rounded-full">
                    {tierLabels[tier]}
                  </span>
                  <span className="text-sm text-muted-foreground">Current plan</span>
                </div>
              </div>
            </>
          )}

          {activeTab === "personalisation" && (
            <>
              <p className="text-sm text-muted-foreground font-extralight">
                Help the AI search assistant get to know you better.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-nickname">Nickname</Label>
                  <Input
                    id="settings-nickname"
                    placeholder="What should the AI call you?"
                    value={personalisation.nickname}
                    onChange={(e) => setPersonalisation((p) => ({ ...p, nickname: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-occupation">Occupation</Label>
                  <Input
                    id="settings-occupation"
                    placeholder="e.g. Property Developer"
                    value={personalisation.occupation}
                    onChange={(e) => setPersonalisation((p) => ({ ...p, occupation: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-business">Business</Label>
                  <Input
                    id="settings-business"
                    placeholder="e.g. Bali Villas Co."
                    value={personalisation.business}
                    onChange={(e) => setPersonalisation((p) => ({ ...p, business: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-about">About</Label>
                  <Textarea
                    id="settings-about"
                    placeholder="Tell us about yourself and your interests in the Bali property market..."
                    rows={3}
                    value={personalisation.about}
                    onChange={(e) => setPersonalisation((p) => ({ ...p, about: e.target.value }))}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
