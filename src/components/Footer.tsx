import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, MapPin, Phone, Github, Twitter, Linkedin, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/mighty-test-logo.png";

const Footer = () => {
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }
    setSubscribing(true);
    const { error } = await supabase.from("newsletter_subscribers").insert([{ email: trimmed }]);
    setSubscribing(false);
    if (error?.code === "23505") {
      toast({ title: "Already subscribed!", description: "This email is already on our list." });
    } else if (error) {
      toast({ title: "Error", description: "Please try again.", variant: "destructive" });
    } else {
      toast({ title: "Subscribed! 🎉", description: "You'll receive our latest updates." });
      setEmail("");
    }
  };

  return (
    <footer className="relative bg-secondary text-secondary-foreground pt-16 pb-8">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-hero" />

      <div className="container mx-auto px-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand + Newsletter */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Mighty Test" className="h-10 w-auto rounded-lg" />
            </div>
            <p className="text-secondary-foreground/70 text-sm">
              Empowering future innovators through intelligent STEM assessment and learning.
            </p>
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="bg-secondary-foreground/10 border-secondary-foreground/20 text-secondary-foreground placeholder:text-secondary-foreground/50 h-9 text-sm"
                maxLength={255}
              />
              <Button type="submit" size="sm" disabled={subscribing} className="flex-shrink-0 h-9">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
            <div className="flex items-center gap-3 pt-1">
              <a href="#" className="p-2 rounded-lg bg-secondary-foreground/10 hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                <Github className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-secondary-foreground/10 hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-secondary-foreground/10 hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-lg mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><a href="#features" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">Features</a></li>
              <li><a href="#subjects" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">Subjects</a></li>
              <li><Link to="/about" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">About Us</Link></li>
              <li><Link to="/contact" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">Contact</Link></li>
              <li><Link to="/faq" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">FAQ</Link></li>
              <li><Link to="/auth" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">Get Started</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-lg mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><Link to="/terms" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">Privacy Policy</Link></li>
            </ul>
            <h4 className="font-bold text-lg mb-4 mt-6">STEM Subjects</h4>
            <ul className="space-y-2 text-secondary-foreground/70 text-sm">
              <li>Science</li>
              <li>Technology</li>
              <li>Engineering</li>
              <li>Mathematics</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-lg mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-secondary-foreground/70">
                <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm">kwabenatekyi19@gmail.com</span>
              </li>
              <li className="flex items-center gap-2 text-secondary-foreground/70">
                <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm">+233 53 698 7839</span>
              </li>
              <li className="flex items-center gap-2 text-secondary-foreground/70">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm">STEM Education Center</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-secondary-foreground/20 text-center text-secondary-foreground/50 text-sm">
          <p>© 2026 Mighty Test. All rights reserved. Empowering STEM education worldwide.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
