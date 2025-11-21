import * as React from "react";
import { cn } from "@/lib/utils";

export interface PlayfulCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: "lift" | "scale" | "glow" | "none";
  animated?: boolean;
}

const PlayfulCard = React.forwardRef<HTMLDivElement, PlayfulCardProps>(
  ({ className, hover = "lift", animated = true, children, ...props }, ref) => {
    const hoverEffects = {
      lift: "hover-lift",
      scale: "hover-scale",
      glow: "hover-glow",
      none: "",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-3xl border-2 bg-card p-6 text-card-foreground shadow-card transition-smooth",
          animated && "animate-scale-in",
          hoverEffects[hover],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PlayfulCard.displayName = "PlayfulCard";

const PlayfulCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
));
PlayfulCardHeader.displayName = "PlayfulCardHeader";

const PlayfulCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-heading text-2xl font-bold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
PlayfulCardTitle.displayName = "PlayfulCardTitle";

const PlayfulCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
PlayfulCardDescription.displayName = "PlayfulCardDescription";

const PlayfulCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-0", className)} {...props} />
));
PlayfulCardContent.displayName = "PlayfulCardContent";

const PlayfulCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
));
PlayfulCardFooter.displayName = "PlayfulCardFooter";

export { PlayfulCard, PlayfulCardHeader, PlayfulCardFooter, PlayfulCardTitle, PlayfulCardDescription, PlayfulCardContent };
