import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, ChevronLeft, Sparkles, Rocket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TourStep {
  targetId: string;
  title: string;
  description: string;
  icon: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'teacher-tour-welcome',
    title: 'Welcome, Educator! 🎓',
    description: 'This is your teaching command center. Let\'s take a quick tour to help you get started and manage your classes effectively!',
    icon: '🚀',
  },
  {
    targetId: 'teacher-tour-exams',
    title: 'Exam Management',
    description: 'Create, edit, and manage your STEM exams here. Set subjects, durations, marks, and publish when ready for students.',
    icon: '📝',
  },
  {
    targetId: 'teacher-tour-schools',
    title: 'Schools & Classes',
    description: 'Manage schools and their classes. Assign students to classes and track class-level performance reports.',
    icon: '🏫',
  },
  {
    targetId: 'teacher-tour-assignments',
    title: 'Exam Assignments',
    description: 'Assign exams to specific classes with due dates. Students in those classes will automatically see the assigned exams.',
    icon: '📋',
  },
  {
    targetId: 'teacher-tour-attempts',
    title: 'Student Submissions',
    description: 'Review and grade student submissions. View detailed answers, award marks for subjective questions, and provide feedback.',
    icon: '✅',
  },
  {
    targetId: 'teacher-tour-students',
    title: 'Student Management',
    description: 'View all enrolled students, manage class assignments, link parents, export grades, and download performance reports.',
    icon: '👩‍🎓',
  },
  {
    targetId: 'teacher-tour-keys',
    title: 'Registration Keys',
    description: 'Generate unique registration keys for new students. Share these keys so students can self-register into their assigned class.',
    icon: '🔑',
  },
];

interface TeacherOnboardingTourProps {
  isActive: boolean;
  onComplete: () => void;
}

export function TeacherOnboardingTour({ isActive, onComplete }: TeacherOnboardingTourProps) {
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

      const spaceBelow = window.innerHeight - rect.bottom;
      const tooltipHeight = 260;
      const tooltipWidth = 380;

      let top: number;
      let left = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));

      if (spaceBelow > tooltipHeight + 20) {
        top = rect.bottom + 16;
      } else {
        top = Math.max(16, rect.top - tooltipHeight - 16);
      }

      setTooltipStyle({ top, left, width: tooltipWidth });
    } else {
      setTargetRect(null);
      setTooltipStyle({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
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

  useEffect(() => {
    if (!isActive) return;
    const step = TOUR_STEPS[currentStep];
    const el = document.getElementById(step.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(updatePosition, 400);
    }
  }, [currentStep, isActive, updatePosition]);

  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const isFirst = currentStep === 0;
  const padding = 10;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-label="Teacher onboarding tour">
      {/* Overlay with spotlight */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="teacher-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#teacher-spotlight-mask)"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* Spotlight ring */}
      {targetRect && (
        <div
          className="absolute rounded-2xl pointer-events-none"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            border: '2px solid hsl(var(--primary))',
            boxShadow: '0 0 0 4px hsl(var(--primary) / 0.2), 0 0 30px hsl(var(--primary) / 0.15)',
            animation: 'pulse-scale 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          ref={tooltipRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="absolute bg-card border-2 border-primary/20 rounded-2xl shadow-2xl overflow-hidden z-10"
          style={tooltipStyle}
        >
          {/* Progress bar */}
          <div className="h-1 bg-muted w-full">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary-light"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          <div className="p-5">
            <button
              onClick={onComplete}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
              aria-label="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-2xl">{step.icon}</span>
              <h3 className="font-bold text-base text-foreground pr-6">{step.title}</h3>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {step.description}
            </p>

            {/* Progress dots */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? 'w-6 bg-primary'
                        : i < currentStep
                        ? 'w-2 bg-primary/50'
                        : 'w-2 bg-muted-foreground/20'
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
                    className="h-8"
                  >
                    <ChevronLeft className="h-4 w-4 mr-0.5" />
                    Back
                  </Button>
                )}
                {isLast ? (
                  <Button size="sm" onClick={onComplete} className="gap-1.5 h-8">
                    <Rocket className="h-3.5 w-3.5" />
                    Start Teaching!
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setCurrentStep(currentStep + 1)} className="gap-1 h-8">
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground/50 mt-3 text-center">
              Step {currentStep + 1} of {TOUR_STEPS.length} • Press Esc to skip
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
