import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

interface TourStep {
  targetId: string;
  title: string;
  description: string;
  icon: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'tour-welcome',
    title: 'Welcome to Your Dashboard! 🎉',
    description: 'This is your STEM learning hub. Let us show you around so you can make the most of it!',
    icon: '🚀',
  },
  {
    targetId: 'tour-profile',
    title: 'Your Profile',
    description: 'View your name, school, grade, and email here. Keep your info up to date!',
    icon: '👤',
  },
  {
    targetId: 'tour-stats',
    title: 'Your Progress Stats',
    description: 'Track how many exams you\'ve taken, passed, your average score, and available exams at a glance.',
    icon: '📊',
  },
  {
    targetId: 'tour-exams',
    title: 'My Exams',
    description: 'See all exams you\'ve registered for. Start pending exams, view results, and download certificates for passed exams!',
    icon: '📝',
  },
  {
    targetId: 'tour-available',
    title: 'Available Exams',
    description: 'Browse new STEM challenges here. Click "Take This Exam" to register and begin!',
    icon: '⚡',
  },
  {
    targetId: 'tour-parent',
    title: 'Parent Access',
    description: 'Share these login credentials with your parent or guardian so they can monitor your progress on their own portal.',
    icon: '👨‍👩‍👧',
  },
];

interface OnboardingTourProps {
  isActive: boolean;
  onComplete: () => void;
}

export function OnboardingTour({ isActive, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const step = TOUR_STEPS[currentStep];
    const el = document.getElementById(step.targetId);

    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);

      // Position tooltip below or above the target
      const spaceBelow = window.innerHeight - rect.bottom;
      const tooltipHeight = 220;
      const tooltipWidth = 340;

      let top: number;
      let left = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));

      if (spaceBelow > tooltipHeight + 20) {
        top = rect.bottom + 16;
      } else {
        top = Math.max(16, rect.top - tooltipHeight - 16);
      }

      setTooltipStyle({ top, left, width: tooltipWidth });
    } else {
      // If element not found, center tooltip
      setTargetRect(null);
      setTooltipStyle({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 360,
      });
    }
  }, [currentStep]);

  useEffect(() => {
    if (!isActive) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isActive, updatePosition]);

  // Scroll target into view
  useEffect(() => {
    if (!isActive) return;
    const step = TOUR_STEPS[currentStep];
    const el = document.getElementById(step.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Re-calculate position after scroll
      setTimeout(updatePosition, 400);
    }
  }, [currentStep, isActive, updatePosition]);

  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const isFirst = currentStep === 0;
  const padding = 8;

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-label="Onboarding tour">
      {/* Overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#spotlight-mask)"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* Spotlight ring */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-xl pointer-events-none animate-pulse"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            boxShadow: '0 0 0 4px hsl(var(--primary) / 0.3)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute bg-card border-2 border-primary/30 rounded-2xl shadow-2xl p-5 z-10 animate-fade-in"
        style={tooltipStyle}
      >
        <button
          onClick={onComplete}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">{step.icon}</span>
          <h3 className="font-bold text-base text-foreground">{step.title}</h3>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {step.description}
        </p>

        {/* Progress dots */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep ? 'w-6 bg-primary' : i < currentStep ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {!isFirst && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentStep(currentStep - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={onComplete} className="gap-1">
                <Sparkles className="h-3 w-3" />
                Let's Go!
              </Button>
            ) : (
              <Button size="sm" onClick={() => setCurrentStep(currentStep + 1)} className="gap-1">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/60 mt-2 text-center">
          {currentStep + 1} of {TOUR_STEPS.length}
        </p>
      </div>
    </div>
  );
}
