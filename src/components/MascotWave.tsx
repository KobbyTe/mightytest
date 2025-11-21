import { Sparkles } from "lucide-react";

export const MascotWave = () => {
  return (
    <div className="relative inline-block animate-float-slow">
      {/* Simple robot mascot placeholder */}
      <div className="relative">
        {/* Robot body */}
        <div className="w-24 h-24 bg-gradient-fun rounded-3xl shadow-playful border-4 border-white dark:border-card flex items-center justify-center">
          <div className="text-4xl animate-wiggle">🤖</div>
        </div>
        
        {/* Sparkle effects */}
        <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-primary animate-sparkle" />
        <Sparkles className="absolute -bottom-2 -left-2 w-5 h-5 text-accent animate-sparkle" style={{ animationDelay: "0.5s" }} />
        
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-fun rounded-3xl opacity-20 blur-xl animate-pulse-scale" />
      </div>
      
      {/* Name tag */}
      <div className="mt-2 text-center">
        <span className="inline-block px-4 py-1 bg-card rounded-full text-sm font-fun font-bold shadow-md border-2 border-primary">
          Robo
        </span>
      </div>
    </div>
  );
};
