import { useEffect, useState, useRef } from "react";
import { Users, FileCheck, School, Trophy } from "lucide-react";

const stats = [
  { icon: Users, label: "Students", target: 500, suffix: "+" },
  { icon: FileCheck, label: "Exams Completed", target: 2000, suffix: "+" },
  { icon: School, label: "Schools", target: 15, suffix: "+" },
  { icon: Trophy, label: "Pass Rate", target: 92, suffix: "%" },
];

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 1500;
          const steps = 40;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-3xl md:text-4xl font-heading font-bold text-primary">
      {count.toLocaleString()}{suffix}
    </div>
  );
}

const StatsBar = () => {
  return (
    <section className="py-16 bg-secondary text-secondary-foreground">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 mb-2">
                <stat.icon className="w-7 h-7 text-primary" />
              </div>
              <AnimatedCounter target={stat.target} suffix={stat.suffix} />
              <p className="text-secondary-foreground/70 text-sm font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsBar;
