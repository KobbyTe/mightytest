import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const animatedBadgeVariants = cva(
  "inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-bold transition-all hover:scale-110 animate-bounce-in",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary/10 text-primary hover:bg-primary/20",
        success: "border-success bg-success/10 text-success hover:bg-success/20",
        science: "border-stem-science bg-stem-science/10 text-stem-science hover:bg-stem-science/20",
        technology: "border-stem-technology bg-stem-technology/10 text-stem-technology hover:bg-stem-technology/20",
        engineering: "border-stem-engineering bg-stem-engineering/10 text-stem-engineering hover:bg-stem-engineering/20",
        mathematics: "border-stem-mathematics bg-stem-mathematics/10 text-stem-mathematics hover:bg-stem-mathematics/20",
        robotics: "border-stem-robotics bg-stem-robotics/10 text-stem-robotics hover:bg-stem-robotics/20",
        ai: "border-stem-ai bg-stem-ai/10 text-stem-ai hover:bg-stem-ai/20",
        fun: "border-fun-pink bg-gradient-fun text-white hover:shadow-playful",
        glow: "border-primary bg-primary text-primary-foreground shadow-glow animate-glow-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface AnimatedBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof animatedBadgeVariants> {}

function AnimatedBadge({ className, variant, ...props }: AnimatedBadgeProps) {
  return (
    <div className={cn(animatedBadgeVariants({ variant }), className)} {...props} />
  );
}

export { AnimatedBadge, animatedBadgeVariants };
