import { motion } from "framer-motion";
import { LayoutDashboard, BookOpen, Zap, Trophy, User, Brain, LogOut, MessageCircle, Library, Code2, FlaskConical } from "lucide-react";
import { NavLink } from "react-router-dom";
import logo from "@/assets/mighty-test-logo.png";
import trophy3d from "@/assets/dashboard-trophy-3d.png";

const navItems = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/dashboard/exams", label: "My Exams", icon: BookOpen },
  { to: "/dashboard/browse", label: "Browse", icon: Zap },
  { to: "/dashboard/coding", label: "Coding", icon: Code2 },
  { to: "/dashboard/projects", label: "Lab Projects", icon: FlaskConical },
  { to: "/dashboard/results", label: "Results", icon: Trophy },
  { to: "/dashboard/library", label: "Library", icon: Library },
  { to: "/dashboard/tutor", label: "Study Buddy", icon: Brain },
  { to: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  { to: "/dashboard/profile", label: "Profile", icon: User },
];

interface Props {
  onSignOut: () => void;
}

export function StudentSidebar({ onSignOut }: Props) {
  return (
    <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col rounded-3xl glass-strong p-5 lg:flex">
      <div className="mb-8 flex items-center gap-2.5">
        <img src={logo} alt="Mighty Test" width={40} height={40} className="h-10 w-10 rounded-xl object-contain" />
        <span className="text-lg font-bold text-brand-darkest">Mighty Test</span>
      </div>

      <nav className="flex-1 space-y-1.5">
        {navItems.map((item, i) => (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
          >
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group relative flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-brand text-primary-foreground shadow-primary"
                    : "text-brand-darkest/70 hover:bg-white/70 hover:text-brand"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-indicator"
                      className="absolute -left-5 h-7 w-1.5 rounded-r-full bg-brand"
                    />
                  )}
                  <item.icon
                    className={`h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110 ${
                      isActive ? "" : "text-brand-muted"
                    }`}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          </motion.div>
        ))}
      </nav>

      <div className="relative mt-4 overflow-hidden rounded-2xl glass-dark p-4 text-center">
        <img
          src={trophy3d}
          alt=""
          loading="lazy"
          width={640}
          height={640}
          className="mx-auto -mt-1 h-16 w-16 animate-float-slow object-contain drop-shadow-xl"
        />
        <p className="mt-2 text-sm font-semibold text-white">Keep the streak alive</p>
        <p className="mt-1 text-xs text-white/70">Ask the AI tutor anything, anytime.</p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white">
          <Brain className="h-3.5 w-3.5" /> AI Tutor ready
        </div>
      </div>

      <button
        onClick={onSignOut}
        className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/40 py-2.5 text-sm font-medium text-brand-darkest/80 transition-all hover:bg-white/80 hover:text-destructive"
      >
        <LogOut className="h-4 w-4" /> Sign Out
      </button>
    </aside>
  );
}
