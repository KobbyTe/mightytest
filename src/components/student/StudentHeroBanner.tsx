import { motion } from "framer-motion";
import { Sparkles, Play } from "lucide-react";
import hero3d from "@/assets/dashboard-hero-3d.png";

interface Props {
  name: string;
  subtitle?: string;
  onPrimary?: () => void;
  primaryLabel?: string;
}

export function StudentHeroBanner({ name, subtitle, onPrimary, primaryLabel = "Start learning" }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl glass-dark px-5 py-7 sm:px-10 sm:py-9"
    >
      {/* animated blobs */}
      <span className="aurora-blob left-[-4rem] top-[-4rem] h-56 w-56 bg-brand-soft/40" />
      <span className="aurora-blob right-10 bottom-[-5rem] h-64 w-64 bg-brand-light/30 [animation-delay:-6s]" />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
        <div className="flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
            <Sparkles className="h-3 w-3" /> STEM • Robotics • AI
          </span>
          <h1 className="mt-3 bg-gradient-to-r from-white via-[hsl(var(--brand-light))] to-white bg-clip-text text-2xl font-bold text-transparent animate-shine sm:text-4xl">
            Hi, {name || "Learner"}
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/75 sm:text-base">
            {subtitle || "Your personal learning hub — track exams, review results and level up every day."}
          </p>
          {onPrimary && (
            <button
              onClick={onPrimary}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-brand shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95"
            >
              <Play className="h-4 w-4" /> {primaryLabel}
            </button>
          )}
        </div>

        <motion.img
          src={hero3d}
          alt="Stack of books with a graduation cap"
          width={1024}
          height={768}
          animate={{ y: [0, -14, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="w-40 shrink-0 object-contain drop-shadow-2xl sm:w-56"
        />
      </div>
    </motion.div>
  );
}
