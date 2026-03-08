import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Rocket, Mail } from "lucide-react";

const CTABanner = () => {
  return (
    <section className="py-20 bg-gradient-to-r from-secondary to-primary relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-background/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-background/5 rounded-full translate-x-1/3 translate-y-1/3" />

      <div className="container mx-auto px-4 relative z-10 text-center">
        <h2 className="text-3xl md:text-5xl font-heading font-bold text-primary-foreground mb-4">
          Ready to Transform STEM Education?
        </h2>
        <p className="text-primary-foreground/80 text-lg max-w-xl mx-auto mb-8">
          Join hundreds of schools already using Mighty Test to assess, track, and improve student performance.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/auth">
            <Button size="lg" className="bg-background text-foreground hover:bg-background/90 shadow-lg text-base px-8">
              <Rocket className="mr-2 w-5 h-5" />
              Get Started Free
            </Button>
          </Link>
          <Link to="/contact">
            <Button size="lg" variant="outline" className="border-2 border-background/40 text-primary-foreground hover:bg-background/10 text-base px-8">
              <Mail className="mr-2 w-5 h-5" />
              Contact Us
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CTABanner;
