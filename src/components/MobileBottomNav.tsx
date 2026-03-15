import { useState, useEffect, useCallback } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BottomNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface MobileBottomNavProps {
  items: BottomNavItem[];
}

function triggerHaptic() {
  if ('vibrate' in navigator) {
    navigator.vibrate(8);
  }
}

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const [active, setActive] = useState(items[0]?.id || '');
  const [tapped, setTapped] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const sections = items.map(item => ({
        id: item.id,
        el: document.getElementById(item.id),
      }));

      let current = items[0]?.id || '';
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
  }, [items]);

  const scrollTo = useCallback((id: string) => {
    triggerHaptic();
    setTapped(id);
    setTimeout(() => setTapped(null), 200);

    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setActive(id);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-card/80 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around px-1 py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const isTapped = tapped === item.id;
          return (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-0 flex-1',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground',
                isTapped ? 'scale-90' : isActive ? 'scale-105' : 'scale-100'
              )}
            >
              <Icon className={cn('h-5 w-5 transition-all duration-200', isActive && 'h-[22px] w-[22px]')} />
              <span className={cn('text-[10px] font-medium truncate transition-all', isActive && 'font-bold')}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
