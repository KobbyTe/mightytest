import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-stem.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Hero = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && role) {
      if (role === 'admin') {
        navigate('/admin');
      } else if (role === 'parent') {
        navigate('/parent');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, role, navigate]);
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Circuit pattern background */}
      <div className="absolute inset-0 circuit-pattern" />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-muted to-primary/10" />
      
      <div className="container relative z-10 px-4 mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text content */}
          <div className="space-y-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-primary bg-primary/10 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Empowering Future Innovators</span>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
              <span className="text-gradient-primary">Mighty Test</span>
              <br />
              <span className="text-foreground">STEM Excellence</span>
              <br />
              <span className="text-foreground">Through Smart Assessment</span>
            </h1>
            
            <p className="text-lg lg:text-xl text-muted-foreground max-w-lg">
              Master Science, Technology, Engineering, Mathematics, Robotics, and AI 
              through intelligent examinations designed to accelerate your learning journey.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              {user ? (
                <Link to={role === 'admin' ? '/admin' : role === 'parent' ? '/parent' : '/dashboard'}>
                  <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 shadow-primary hover:shadow-glow transition-all duration-300 hover:scale-105">
                    <LayoutDashboard className="mr-2 w-5 h-5" />
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth">
                    <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 shadow-primary hover:shadow-glow transition-all duration-300 hover:scale-105">
                      Get Started
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="w-full sm:w-auto text-lg px-8 py-6 border-2 border-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                  >
                    Explore Features
                  </Button>
                </>
              )}
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-primary">10K+</div>
                <div className="text-sm text-muted-foreground">Students</div>
              </div>
              <div className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-primary">500+</div>
                <div className="text-sm text-muted-foreground">STEM Exams</div>
              </div>
              <div className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-primary">98%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
            </div>
          </div>
          
          {/* Hero image */}
          <div className="relative animate-fade-in">
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent opacity-20 blur-3xl animate-glow-pulse" />
            <img 
              src={heroImage} 
              alt="STEM Education Platform" 
              className="relative rounded-2xl shadow-2xl border-4 border-primary/20 hover:border-primary/40 transition-all duration-500 hover:scale-105"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
