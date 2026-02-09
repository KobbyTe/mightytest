import { Beaker, Code2, Cog, Calculator, BrainCircuit, Bot, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const subjects = [
  {
    icon: Beaker,
    title: "Science",
    description: "Physics, Chemistry, Biology",
    color: "text-stem-science",
    bgColor: "bg-stem-science",
    borderColor: "border-stem-science",
  },
  {
    icon: Code2,
    title: "Technology",
    description: "Programming, Web Dev, Cybersecurity",
    color: "text-stem-technology",
    bgColor: "bg-stem-technology",
    borderColor: "border-stem-technology",
  },
  {
    icon: Cog,
    title: "Engineering",
    description: "Mechanical, Electrical, Software",
    color: "text-stem-engineering",
    bgColor: "bg-stem-engineering",
    borderColor: "border-stem-engineering",
  },
  {
    icon: Calculator,
    title: "Mathematics",
    description: "Algebra, Calculus, Statistics",
    color: "text-stem-mathematics",
    bgColor: "bg-stem-mathematics",
    borderColor: "border-stem-mathematics",
  },
  {
    icon: Bot,
    title: "Robotics",
    description: "Sensors, Control Systems, Kinematics",
    color: "text-stem-robotics",
    bgColor: "bg-stem-robotics",
    borderColor: "border-stem-robotics",
  },
  {
    icon: BrainCircuit,
    title: "Artificial Intelligence",
    description: "Machine Learning, Neural Networks",
    color: "text-stem-ai",
    bgColor: "bg-stem-ai",
    borderColor: "border-stem-ai",
  },
];

const Subjects = () => {
  return (
    <section id="subjects" className="relative py-24">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 dots-pattern pointer-events-none" />

      <div className="container relative mx-auto px-4">
        <div className="text-center space-y-4 mb-16 animate-fade-in-up">
          <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-primary">
            Explore Subjects
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold">
            <span className="text-foreground">Master All </span>
            <span className="text-gradient-primary">STEM Subjects</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive examination platform covering every aspect of modern STEM education
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subject, index) => {
            const Icon = subject.icon;
            return (
              <div
                key={index}
                className={`group relative overflow-hidden rounded-2xl border-2 ${subject.borderColor} bg-card p-8 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 cursor-pointer animate-scale-in`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Gradient background on hover */}
                <div className={`absolute inset-0 ${subject.bgColor} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                
                <div className="relative z-10">
                  <div className={`inline-flex p-4 rounded-xl ${subject.bgColor}/20 mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-10 h-10 ${subject.color}`} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">
                    {subject.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {subject.description}
                  </p>
                </div>

                {/* Decorative corner */}
                <div className={`absolute -top-8 -right-8 w-24 h-24 ${subject.bgColor} opacity-10 rounded-full group-hover:scale-150 transition-transform duration-500`} />
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Link to="/auth">
            <Button size="lg" className="text-lg px-10 py-7 shadow-primary hover:shadow-glow transition-all duration-300 hover:scale-105">
              Start Your STEM Journey
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Subjects;
