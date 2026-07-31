import { Button } from "@/components/ui/button";
import { BookOpen, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import heroLearner from "@/assets/hero-learner.png";

const DottedPattern = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 120 120"
    aria-hidden="true"
    className={`pointer-events-none absolute text-brand-soft ${className}`}
  >
    {Array.from({ length: 5 }).map((_, row) =>
      Array.from({ length: 5 }).map((_, col) => (
        <line
          key={`${row}-${col}`}
          x1={col * 24 + 4}
          y1={row * 24 + 4}
          x2={col * 24 + 14}
          y2={row * 24 + 14}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity={0.7 - row * 0.1}
        />
      ))
    )}
  </svg>
);

const Hero = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && role) {
      if (role === "admin") navigate("/admin");
      else if (role === "parent") navigate("/parent");
      else navigate("/dashboard");
    }
  }, [user, role, navigate]);

  const dashboardPath = role === "admin" ? "/admin" : role === "parent" ? "/parent" : "/dashboard";

  return (
    <section className="relative overflow-hidden bg-brand-light">
      <DottedPattern className="-left-4 top-2 h-20 w-20 opacity-70 md:h-24 md:w-24" />

      <div className="container relative mx-auto grid items-center gap-10 px-4 py-14 md:py-20 lg:grid-cols-2">
        {/* Left */}
        <div className="relative z-10 space-y-6 animate-fade-in">
          <p className="text-sm font-semibold text-brand-muted">Start your favourite course</p>

          <h1 className="text-4xl font-bold leading-tight text-brand-darkest sm:text-5xl lg:text-[3.4rem]">
            Now learning from anywhere, and build your{" "}
            <span className="relative whitespace-nowrap text-brand">
              bright career.
              <svg
                viewBox="0 0 220 12"
                aria-hidden="true"
                className="absolute -bottom-2 left-0 w-full text-brand"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 8C60 2 160 2 218 7"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            Learn at your own pace with expert-led courses, smart assessments and
            progress tracking built for every kind of learner.
          </p>

          <Link to={user ? dashboardPath : "/auth"}>
            <Button
              size="lg"
              className="rounded-full bg-brand px-8 py-6 text-base font-semibold text-primary-foreground shadow-primary transition-transform hover:scale-105"
            >
              {user ? "Go to Dashboard" : "Start A Course"}
            </Button>
          </Link>
        </div>

        {/* Right */}
        <div className="relative">
          {/* Curved decorative arrows */}
          <svg
            viewBox="0 0 400 400"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full text-brand-soft"
          >
            <path
              d="M60 90 C110 40, 190 40, 230 80"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
            <path d="M222 62 L233 82 L211 84 Z" fill="currentColor" />
            <path
              d="M370 300 C395 220, 380 130, 330 70"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
            <path d="M322 92 L331 66 L348 86 Z" fill="currentColor" />
          </svg>

          <img
            src={heroLearner}
            alt="Student smiling while holding a laptop"
            width={1024}
            height={1024}
            className="relative z-10 mx-auto w-full max-w-md object-contain drop-shadow-xl"
          />

          {/* Courses badge */}
          <div className="absolute left-2 top-1/3 z-20 flex h-24 w-24 flex-col items-center justify-center rounded-full bg-brand text-primary-foreground shadow-primary sm:left-6 md:h-28 md:w-28">
            <BookOpen className="mb-1 h-5 w-5" />
            <span className="text-lg font-bold leading-none">1,235</span>
            <span className="text-[11px] opacity-90">courses</span>
          </div>

          {/* Rating badge */}
          <div className="absolute right-0 top-2 z-20 flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-card">
            <span className="text-base font-bold text-brand-darkest">4.8</span>
            <Star className="h-4 w-4 fill-brand-muted text-brand-muted" />
            <span className="text-xs text-muted-foreground">rating (80K)</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
