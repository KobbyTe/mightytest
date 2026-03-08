import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/mighty-test-logo.png";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, role } = useAuth();

  const getDashboardPath = () => {
    if (role === 'admin') return '/admin';
    if (role === 'parent') return '/parent';
    return '/dashboard';
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <img src={logo} alt="Mighty Test" className="h-10 w-auto rounded-lg" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">
              Features
            </a>
            <a href="#subjects" className="text-sm font-medium hover:text-primary transition-colors">
              Subjects
            </a>
            <Link to="/about" className="text-sm font-medium hover:text-primary transition-colors">
              About
            </Link>
            <Link to="/contact" className="text-sm font-medium hover:text-primary transition-colors">
              Contact
            </Link>
            {user ? (
              <Link to={getDashboardPath()}>
                <Button className="shadow-primary hover:shadow-glow transition-all">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="outline" className="border-2 border-primary hover:bg-primary hover:text-primary-foreground transition-all">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button className="shadow-primary hover:shadow-glow transition-all">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 space-y-4 animate-fade-in">
            <a 
              href="#features" 
              className="block py-2 text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Features
            </a>
            <a 
              href="#subjects" 
              className="block py-2 text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Subjects
            </a>
            <Link 
              to="/about" 
              className="block py-2 text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setIsOpen(false)}
            >
              About
            </Link>
            <Link 
              to="/contact" 
              className="block py-2 text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Contact
            </Link>
            <div className="space-y-2 pt-4">
              {user ? (
                <Link to={getDashboardPath()} onClick={() => setIsOpen(false)}>
                  <Button className="w-full shadow-primary">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setIsOpen(false)}>
                    <Button variant="outline" className="w-full border-2 border-primary">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/auth" onClick={() => setIsOpen(false)}>
                    <Button className="w-full shadow-primary">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
