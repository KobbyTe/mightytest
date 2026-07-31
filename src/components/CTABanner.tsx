import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Dots = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 80 80" aria-hidden="true" className={`pointer-events-none absolute text-brand-soft ${className}`}>
    {Array.from({ length: 3 }).map((_, row) =>
      Array.from({ length: 3 }).map((_, col) => (
        <line
          key={`${row}-${col}`}
          x1={col * 22 + 4}
          y1={row * 22 + 4}
          x2={col * 22 + 13}
          y2={row * 22 + 13}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity={0.75 - row * 0.15}
        />
      ))
    )}
  </svg>
);

const CTABanner = () => {
  return (
    <section className="bg-background py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand-light px-6 py-10 md:px-12 md:py-12">
          <Dots className="left-3 bottom-3 h-16 w-16" />
          <Dots className="right-5 top-4 h-16 w-16" />

          <div className="relative z-10 flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-brand-muted">Become A Instructor</p>
              <h2 className="max-w-md text-2xl font-bold leading-snug text-brand-darkest md:text-3xl">
                You can join with Edule as{" "}
                <span className="relative whitespace-nowrap text-brand">
                  a instructor?
                  <svg
                    viewBox="0 0 200 10"
                    aria-hidden="true"
                    preserveAspectRatio="none"
                    className="absolute -bottom-1 left-0 w-full text-brand"
                  >
                    <path d="M2 7C60 2 140 2 198 6" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <svg viewBox="0 0 140 60" aria-hidden="true" className="hidden h-14 w-32 text-brand-soft lg:block">
                <path
                  d="M4 46C40 8 96 6 132 26"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                />
                <path d="M118 16 L134 27 L116 34 Z" fill="currentColor" />
              </svg>

              <Link to="/contact">
                <Button
                  size="lg"
                  className="rounded-full bg-brand px-8 text-primary-foreground shadow-primary transition-transform hover:scale-105"
                >
                  Drop Information
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTABanner;
