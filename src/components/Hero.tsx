import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, LayoutDashboard, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const HERO_VIDEO_URL =
  "https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4";

const Hero = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [videoLoaded, setVideoLoaded] = useState(false);

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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        onCanPlay={() => setVideoLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${videoLoaded ? "opacity-100" : "opacity-0"}`}
      >
        <source src={HERO_VIDEO_URL} type="video/mp4" />
      </video>

      {/* Gradient fallback (visible while video loads) */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary to-primary/20" />

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

      {/* Content */}
      <div className="container relative z-10 px-4 mx-auto flex flex-col items-center text-center">
        <div className="max-w-3xl space-y-8 animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-white/90">Empowering Future Innovators</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
            <span className="text-gradient-primary">Mighty Test</span>
            <br />
            <span className="text-white">STEM Excellence</span>
            <br />
            <span className="text-white/80">Through Smart Assessment</span>
          </h1>

          {/* Description */}
          <p className="text-lg lg:text-xl text-white/70 max-w-2xl mx-auto">
            Master Science, Technology, Engineering, Mathematics, Robotics, and AI
            through intelligent examinations designed to accelerate your learning journey.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            {user ? (
              <Link to={role === 'admin' ? '/admin' : role === 'parent' ? '/parent' : '/dashboard'}>
                <Button size="lg" className="w-full sm:w-auto text-lg px-10 py-7 shadow-primary hover:shadow-glow transition-all duration-300 hover:scale-105">
                  <LayoutDashboard className="mr-2 w-5 h-5" />
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button size="lg" className="w-full sm:w-auto text-lg px-10 py-7 shadow-primary hover:shadow-glow transition-all duration-300 hover:scale-105">
                    Get Started
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto text-lg px-10 py-7 border-2 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm transition-all duration-300"
                >
                  Explore Features
                </Button>
              </>
            )}
          </div>

          {/* Stats with frosted glass */}
          <div className="grid grid-cols-3 gap-6 pt-8 max-w-lg mx-auto">
            <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/10 py-4 px-3">
              <div className="text-3xl lg:text-4xl font-bold text-primary">10K+</div>
              <div className="text-sm text-white/60">Students</div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/10 py-4 px-3">
              <div className="text-3xl lg:text-4xl font-bold text-primary">500+</div>
              <div className="text-sm text-white/60">STEM Exams</div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/10 py-4 px-3">
              <div className="text-3xl lg:text-4xl font-bold text-primary">98%</div>
              <div className="text-sm text-white/60">Success Rate</div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-8 h-8 text-white/50" />
        </div>
      </div>
    </section>
  );
};

export default Hero;
