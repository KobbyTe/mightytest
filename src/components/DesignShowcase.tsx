import { Sparkles, Rocket, Brain, Zap, Trophy, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedBadge } from "@/components/ui/animated-badge";
import { PlayfulCard, PlayfulCardContent, PlayfulCardDescription, PlayfulCardHeader, PlayfulCardTitle } from "@/components/ui/playful-card";
import { MascotWave } from "./MascotWave";

export const DesignShowcase = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-6 animate-fade-in-up">
          <div className="flex justify-center">
            <MascotWave />
          </div>
          <h1 className="font-heading text-6xl font-bold text-gradient-primary">
            Nsɔhwɛ Design System
          </h1>
          <p className="text-xl text-muted-foreground font-rounded max-w-2xl mx-auto">
            Learn, Play, Succeed - STEM Made Fun! 🚀
          </p>
        </div>

        {/* Button Variants */}
        <section className="space-y-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="font-heading text-3xl font-bold text-center">Playful Buttons</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button variant="default" size="lg">
              <Rocket className="w-5 h-5" />
              Start Learning
            </Button>
            <Button variant="fun" size="lg">
              <Sparkles className="w-5 h-5" />
              Explore Now
            </Button>
            <Button variant="playful" size="lg">
              <Brain className="w-5 h-5" />
              Take Exam
            </Button>
            <Button variant="success" size="lg">
              <Trophy className="w-5 h-5" />
              View Results
            </Button>
            <Button variant="glow" size="lg">
              <Zap className="w-5 h-5" />
              Get Started
            </Button>
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </div>
        </section>

        {/* Badge Variants */}
        <section className="space-y-6 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <h2 className="font-heading text-3xl font-bold text-center">Subject Badges</h2>
          <div className="flex flex-wrap gap-3 justify-center">
            <AnimatedBadge variant="science">🔬 Science</AnimatedBadge>
            <AnimatedBadge variant="technology">💻 Technology</AnimatedBadge>
            <AnimatedBadge variant="engineering">⚙️ Engineering</AnimatedBadge>
            <AnimatedBadge variant="mathematics">🔢 Mathematics</AnimatedBadge>
            <AnimatedBadge variant="robotics">🤖 Robotics</AnimatedBadge>
            <AnimatedBadge variant="ai">🧠 AI</AnimatedBadge>
            <AnimatedBadge variant="fun">✨ Fun Mode</AnimatedBadge>
            <AnimatedBadge variant="glow">⭐ Premium</AnimatedBadge>
          </div>
        </section>

        {/* Card Examples */}
        <section className="space-y-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <h2 className="font-heading text-3xl font-bold text-center">Interactive Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PlayfulCard hover="lift">
              <PlayfulCardHeader>
                <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center mb-4 shadow-primary">
                  <Rocket className="w-6 h-6 text-white" />
                </div>
                <PlayfulCardTitle>Quick Start</PlayfulCardTitle>
                <PlayfulCardDescription>
                  Begin your STEM journey today
                </PlayfulCardDescription>
              </PlayfulCardHeader>
              <PlayfulCardContent>
                <p className="text-sm text-muted-foreground">
                  Take your first exam and discover your strengths!
                </p>
              </PlayfulCardContent>
            </PlayfulCard>

            <PlayfulCard hover="scale" className="border-accent">
              <PlayfulCardHeader>
                <div className="w-12 h-12 bg-gradient-fun rounded-2xl flex items-center justify-center mb-4 shadow-playful">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <PlayfulCardTitle className="text-gradient-fun">AI Insights</PlayfulCardTitle>
                <PlayfulCardDescription>
                  Get personalized learning tips
                </PlayfulCardDescription>
              </PlayfulCardHeader>
              <PlayfulCardContent>
                <p className="text-sm text-muted-foreground">
                  AI-powered recommendations just for you!
                </p>
              </PlayfulCardContent>
            </PlayfulCard>

            <PlayfulCard hover="glow" className="border-success">
              <PlayfulCardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-success to-fun-mint rounded-2xl flex items-center justify-center mb-4 shadow-success">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <PlayfulCardTitle className="text-gradient-success">Achievements</PlayfulCardTitle>
                <PlayfulCardDescription>
                  Unlock badges and rewards
                </PlayfulCardDescription>
              </PlayfulCardHeader>
              <PlayfulCardContent>
                <p className="text-sm text-muted-foreground">
                  Collect trophies as you master STEM!
                </p>
              </PlayfulCardContent>
            </PlayfulCard>
          </div>
        </section>

        {/* Typography Examples */}
        <section className="space-y-6 animate-slide-up" style={{ animationDelay: "0.4s" }}>
          <h2 className="font-heading text-3xl font-bold text-center">Typography</h2>
          <div className="bg-card p-8 rounded-3xl shadow-card space-y-4">
            <h1 className="font-heading text-5xl font-bold">Heading Font (Fredoka)</h1>
            <h2 className="font-display text-4xl font-bold">Display Font (Poppins)</h2>
            <h3 className="font-fun text-3xl font-bold text-gradient-fun">Fun Font (Baloo 2)</h3>
            <p className="font-rounded text-xl">Rounded Font (Quicksand)</p>
            <p className="font-sans text-base">Body Font (Inter) - Perfect for reading long content with excellent clarity and comfortable spacing.</p>
          </div>
        </section>

        {/* Color Palette */}
        <section className="space-y-6 animate-slide-up" style={{ animationDelay: "0.5s" }}>
          <h2 className="font-heading text-3xl font-bold text-center">Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="h-24 bg-primary rounded-2xl shadow-primary hover-scale" />
              <p className="text-sm font-semibold text-center">Primary</p>
            </div>
            <div className="space-y-2">
              <div className="h-24 bg-secondary rounded-2xl shadow-lg hover-scale" />
              <p className="text-sm font-semibold text-center">Secondary</p>
            </div>
            <div className="space-y-2">
              <div className="h-24 bg-accent rounded-2xl shadow-playful hover-scale" />
              <p className="text-sm font-semibold text-center">Accent</p>
            </div>
            <div className="space-y-2">
              <div className="h-24 bg-success rounded-2xl shadow-success hover-scale" />
              <p className="text-sm font-semibold text-center">Success</p>
            </div>
            <div className="space-y-2">
              <div className="h-24 bg-purple rounded-2xl shadow-lg hover-scale" />
              <p className="text-sm font-semibold text-center">Purple</p>
            </div>
            <div className="space-y-2">
              <div className="h-24 bg-gradient-fun rounded-2xl shadow-playful hover-scale" />
              <p className="text-sm font-semibold text-center">Fun Gradient</p>
            </div>
            <div className="space-y-2">
              <div className="h-24 bg-gradient-primary rounded-2xl shadow-primary hover-scale" />
              <p className="text-sm font-semibold text-center">Primary Gradient</p>
            </div>
            <div className="space-y-2">
              <div className="h-24 bg-gradient-purple rounded-2xl shadow-lg hover-scale" />
              <p className="text-sm font-semibold text-center">Purple Gradient</p>
            </div>
          </div>
        </section>

        {/* Animation Examples */}
        <section className="space-y-6 animate-slide-up" style={{ animationDelay: "0.6s" }}>
          <h2 className="font-heading text-3xl font-bold text-center">Animations</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-card p-6 rounded-2xl shadow-card text-center">
              <Star className="w-12 h-12 mx-auto text-primary animate-float mb-2" />
              <p className="text-sm font-semibold">Float</p>
            </div>
            <div className="bg-card p-6 rounded-2xl shadow-card text-center">
              <Sparkles className="w-12 h-12 mx-auto text-accent animate-spin-slow mb-2" />
              <p className="text-sm font-semibold">Spin</p>
            </div>
            <div className="bg-card p-6 rounded-2xl shadow-card text-center">
              <Zap className="w-12 h-12 mx-auto text-success animate-pulse-scale mb-2" />
              <p className="text-sm font-semibold">Pulse</p>
            </div>
            <div className="bg-card p-6 rounded-2xl shadow-card text-center">
              <Trophy className="w-12 h-12 mx-auto text-purple animate-bounce-in mb-2" />
              <p className="text-sm font-semibold">Bounce</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">
            Design system ready for Nsɔhwɛ platform 🎨
          </p>
          <Button variant="glow" size="xl" className="font-heading">
            <Rocket className="w-6 h-6" />
            Let's Build Something Amazing!
          </Button>
        </div>
      </div>
    </div>
  );
};
