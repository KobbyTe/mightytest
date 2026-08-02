import { useCallback, useState } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BottomNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface MobileBottomNavProps {
  items: BottomNavItem[];
  /** Currently active item id — when provided the nav behaves as a page switcher */
  activeId?: string;
  /** Called with the item id when tapped. Falls back to smooth-scrolling to #id */
  onSelect?: (id: string) => void;
}

function triggerHaptic() {
  if ('vibrate' in navigator) {
    navigator.vibrate(8);
  }
}

export function MobileBottomNav({ items, activeId, onSelect }: MobileBottomNavProps) {
  const [tapped, setTapped] = useState<string | null>(null);

  const handleTap = useCallback(
    (id: string) => {
      triggerHaptic();
      setTapped(id);
      setTimeout(() => setTapped(null), 200);

      if (onSelect) {
        onSelect(id);
        return;
      }
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [onSelect]
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card/80 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around px-1 py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          const isTapped = tapped === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTap(item.id)}
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
