import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface FeedbackDialogProps {
  open: boolean;
  rating: "like" | "dislike" | null;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}

export function FeedbackDialog({ open, rating, onClose, onSubmit }: FeedbackDialogProps) {
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open) setComment("");
  }, [open]);

  const isPositive = rating === "like";
  const title = isPositive ? "What did you like?" : "What could be better?";
  const placeholder = isPositive
    ? "Optional: tell us what worked well"
    : "Optional: tell us what was missing or incorrect";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPositive ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
            {title}
          </DialogTitle>
          <DialogDescription>
            Your feedback helps us improve. Comments are optional.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="resize-none"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit(comment)}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
