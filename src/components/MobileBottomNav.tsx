import { useState, useEffect } from 'react';
import { BookOpen, Trophy, User, Zap, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { id: 'dashboard-top', label: 'Home', icon: LayoutDashboard },
  { id: 'section-exams', label: 'Exams', icon: BookOpen },
  { id: 'section-available', label: 'Browse', icon: Zap },
  { id: 'section-results', label: 'Results', icon: Trophy },
  { id: 'section-profile', label: 'Profile', icon: User },
];

export function MobileBottomNav() {
  const [active, setActive] = useState('dashboard-top');

  useEffect(() => {
    const handleScroll = () => {
      const sections = navItems.map(item => ({
        id: item.id,
        el: document.getElementById(item.id),
      }));

      let current = 'dashboard-top';
      for (const section of sections) {
        if (section.el) {
          const rect = section.el.getBoundingClientRect();
          if (rect.top <= 150) {
            current = section.id;
          }
        }
      }
      setActive(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setActive(id);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-card/80 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around px-1 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-0 flex-1',
                isActive
                  ? 'text-primary bg-primary/10 scale-105'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5 transition-all', isActive && 'h-[22px] w-[22px]')} />
              <span className={cn('text-[10px] font-medium truncate', isActive && 'font-bold')}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
