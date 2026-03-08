import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Flame, Trophy, Zap, Star, Award, Target, Crown, Medal, Sparkles } from 'lucide-react';

interface ExamAttempt {
  id: string;
  status: string;
  marks_obtained: number | null;
  attempted_at: string;
  exams: {
    total_marks: number;
    passing_marks: number;
    subject?: string;
  };
}

interface StudentGamificationProps {
  examAttempts: ExamAttempt[];
  studentName: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  color: string;
}

const XP_PER_EXAM = 50;
const XP_PER_PASS = 100;
const XP_PER_PERFECT = 200;
const XP_PER_LEVEL = 500;

export function StudentGamification({ examAttempts, studentName }: StudentGamificationProps) {
  const stats = useMemo(() => {
    const graded = examAttempts.filter(a => a.status === 'graded' && a.marks_obtained !== null);
    const passed = graded.filter(a => a.marks_obtained! >= a.exams.passing_marks);
    const perfect = graded.filter(a => a.marks_obtained === a.exams.total_marks);
    
    // Calculate XP
    let xp = graded.length * XP_PER_EXAM;
    xp += passed.length * XP_PER_PASS;
    xp += perfect.length * XP_PER_PERFECT;
    
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const xpInLevel = xp % XP_PER_LEVEL;
    const xpProgress = (xpInLevel / XP_PER_LEVEL) * 100;
    
    // Streak calculation (consecutive passes by date)
    const sortedGraded = [...graded].sort((a, b) => 
      new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime()
    );
    let streak = 0;
    for (const attempt of sortedGraded) {
      if (attempt.marks_obtained! >= attempt.exams.passing_marks) {
        streak++;
      } else {
        break;
      }
    }

    return { graded: graded.length, passed: passed.length, perfect: perfect.length, xp, level, xpInLevel, xpProgress, streak };
  }, [examAttempts]);

  const achievements: Achievement[] = useMemo(() => [
    {
      id: 'first-exam',
      title: 'First Steps',
      description: 'Complete your first exam',
      icon: <Star className="h-5 w-5" />,
      unlocked: stats.graded >= 1,
      color: 'from-primary to-primary-light',
    },
    {
      id: 'five-exams',
      title: 'Dedicated Learner',
      description: 'Complete 5 exams',
      icon: <Target className="h-5 w-5" />,
      unlocked: stats.graded >= 5,
      color: 'from-accent to-[hsl(var(--fun-teal))]',
    },
    {
      id: 'first-pass',
      title: 'Rising Star',
      description: 'Pass your first exam',
      icon: <Trophy className="h-5 w-5" />,
      unlocked: stats.passed >= 1,
      color: 'from-[hsl(var(--success))] to-[hsl(var(--fun-mint))]',
    },
    {
      id: 'perfect-score',
      title: 'Perfectionist',
      description: 'Score 100% on any exam',
      icon: <Crown className="h-5 w-5" />,
      unlocked: stats.perfect >= 1,
      color: 'from-[hsl(var(--purple))] to-[hsl(var(--fun-lavender))]',
    },
    {
      id: 'streak-3',
      title: 'On Fire',
      description: 'Pass 3 exams in a row',
      icon: <Flame className="h-5 w-5" />,
      unlocked: stats.streak >= 3,
      color: 'from-secondary to-[hsl(var(--fun-coral))]',
    },
    {
      id: 'level-5',
      title: 'Scholar',
      description: 'Reach Level 5',
      icon: <Award className="h-5 w-5" />,
      unlocked: stats.level >= 5,
      color: 'from-[hsl(var(--fun-pink))] to-[hsl(var(--purple))]',
    },
  ], [stats]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const getLevelTitle = (level: number) => {
    if (level >= 10) return 'Master Scholar';
    if (level >= 7) return 'Expert';
    if (level >= 5) return 'Scholar';
    if (level >= 3) return 'Learner';
    return 'Beginner';
  };

  return (
    <div className="space-y-4">
      {/* XP & Level Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="overflow-hidden border-primary/20">
          <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-accent" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                    <span className="text-xl font-black text-primary-foreground">{stats.level}</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                    <Zap className="h-3 w-3 text-accent-foreground" />
                  </div>
                </div>
                <div>
                  <p className="font-bold text-lg">Level {stats.level} — {getLevelTitle(stats.level)}</p>
                  <p className="text-xs text-muted-foreground">{stats.xpInLevel} / {XP_PER_LEVEL} XP to next level</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-center">
                {stats.streak > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/10 border border-secondary/20">
                    <Flame className="h-4 w-4 text-secondary" />
                    <span className="font-bold text-sm text-secondary">{stats.streak}</span>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-2xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    {stats.xp.toLocaleString()}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total XP</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <Progress value={stats.xpProgress} className="h-3 bg-muted" />
              <motion.div
                className="absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r from-primary to-secondary"
                initial={{ width: 0 }}
                animate={{ width: `${stats.xpProgress}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Achievements Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Achievements
              </span>
              <Badge variant="secondary" className="text-xs">
                {unlockedCount}/{achievements.length} Unlocked
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {achievements.map((achievement, i) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 * i }}
                  className={`relative p-3 rounded-xl border text-center transition-all ${
                    achievement.unlocked
                      ? 'bg-card shadow-sm border-primary/20 hover:shadow-md'
                      : 'bg-muted/30 border-border/50 opacity-50 grayscale'
                  }`}
                >
                  <div className={`w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center ${
                    achievement.unlocked
                      ? `bg-gradient-to-br ${achievement.color} text-white shadow-sm`
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {achievement.icon}
                  </div>
                  <p className="font-semibold text-xs leading-tight">{achievement.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{achievement.description}</p>
                  {achievement.unlocked && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[hsl(var(--success))] flex items-center justify-center">
                      <Star className="h-2.5 w-2.5 text-white fill-white" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
