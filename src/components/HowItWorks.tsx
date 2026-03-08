import { UserPlus, ClipboardCheck, BarChart3, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Register",
    description: "Sign up with a registration key from your school. Set up your profile in seconds.",
    color: "bg-accent text-accent-foreground",
  },
  {
    icon: ClipboardCheck,
    title: "Take Exams",
    description: "Complete assigned STEM exams online with timed sessions and auto-save features.",
    color: "bg-success text-success-foreground",
  },
  {
    icon: BarChart3,
    title: "Track Progress",
    description: "View detailed results, get AI-powered feedback, and watch your scores improve over time.",
    color: "bg-purple text-purple-foreground",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">
            How It Works
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Get started in three simple steps
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-4 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.title} className="flex items-center gap-4">
              <div className="flex flex-col items-center text-center max-w-[240px]">
                <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <step.icon className="w-8 h-8" />
                </div>
                <span className="text-xs font-bold text-primary mb-1">STEP {index + 1}</span>
                <h3 className="text-xl font-heading font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight className="hidden md:block w-8 h-8 text-border flex-shrink-0 mt-[-40px]" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
