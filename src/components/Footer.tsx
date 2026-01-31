import { Link } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";
import logo from "@/assets/mighty-test-logo.png";

const Footer = () => {
  return (
    <footer className="bg-secondary text-secondary-foreground py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Mighty Test" className="h-10 w-auto" />
            </div>
            <p className="text-secondary-foreground/70">
              Empowering future innovators through intelligent STEM assessment and learning.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-lg mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/#features" className="text-secondary-foreground/70 hover:text-primary transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/#subjects" className="text-secondary-foreground/70 hover:text-primary transition-colors">
                  Subjects
                </Link>
              </li>
              <li>
                <Link to="/auth" className="text-secondary-foreground/70 hover:text-primary transition-colors">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          {/* STEM Subjects */}
          <div>
            <h4 className="font-bold text-lg mb-4">STEM Subjects</h4>
            <ul className="space-y-2 text-secondary-foreground/70">
              <li>Science</li>
              <li>Technology</li>
              <li>Engineering</li>
              <li>Mathematics</li>
              <li>Robotics</li>
              <li>Artificial Intelligence</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-lg mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-secondary-foreground/70">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-sm">info@mightytest.com</span>
              </li>
              <li className="flex items-center gap-2 text-secondary-foreground/70">
                <Phone className="w-4 h-4 text-primary" />
                <span className="text-sm">+1 (555) 123-4567</span>
              </li>
              <li className="flex items-center gap-2 text-secondary-foreground/70">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm">STEM Education Center</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-secondary-foreground/20 text-center text-secondary-foreground/70 text-sm">
          <p>© 2024 Mighty Test. All rights reserved. Empowering STEM education worldwide.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
