import { Brain, Code, LineChart, Zap, Shield, Trophy } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description: "Get personalized STEM learning recommendations based on your performance patterns",
    color: "text-stem-ai",
    bgColor: "bg-stem-ai/10",
  },
  {
    icon: Code,
    title: "Live Code Execution",
    description: "Test your programming skills with real-time code compilation and validation",
    color: "text-stem-technology",
    bgColor: "bg-stem-technology/10",
  },
  {
    icon: LineChart,
    title: "Advanced Analytics",
    description: "Track your progress across Science, Math, Engineering, Robotics, and AI",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: Zap,
    title: "Adaptive Difficulty",
    description: "Questions that adjust to your skill level for optimal learning outcomes",
    color: "text-stem-robotics",
    bgColor: "bg-stem-robotics/10",
  },
  {
    icon: Shield,
    title: "Secure Examinations",
    description: "Proctored exams with anti-cheating measures and real-time monitoring",
    color: "text-stem-engineering",
    bgColor: "bg-stem-engineering/10",
  },
  {
    icon: Trophy,
    title: "Achievement System",
    description: "Earn badges and compete with peers in STEM challenges and competitions",
    color: "text-stem-science",
    bgColor: "bg-stem-science/10",
  },
];

const Features = () => {
  return (
    <section id="features" className="relative py-24 bg-muted/30">
      {/* Gradient divider from hero */}
      <div className="absolute top-0 left-0 right-0 h-24 -translate-y-full bg-gradient-to-b from-transparent to-muted/30 pointer-events-none" />
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4 mb-16 animate-fade-in-up">
          <h2 className="text-4xl lg:text-5xl font-bold">
            <span className="text-gradient-primary">Powerful Features</span>
            <br />
            <span className="text-foreground">for STEM Mastery</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to excel in Science, Technology, Engineering, Mathematics, Robotics, and AI
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group p-6 rounded-2xl border-2 border-border bg-card hover:border-primary transition-all duration-300 hover:shadow-primary hover:-translate-y-2 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`inline-flex p-3 rounded-xl ${feature.bgColor} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-8 h-8 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
