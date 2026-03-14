import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Volume2, Play, Square, Mic, ArrowRight, SkipForward, Check } from 'lucide-react';
import { type SpeechSpeed } from '@/hooks/useReadingAssistant';

interface VoiceSelectionDialogProps {
  open: boolean;
  onContinue: () => void;
  onSkip: () => void;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  onSelectVoice: (voice: SpeechSynthesisVoice) => void;
  speed: SpeechSpeed;
  onSpeedChange: (speed: SpeechSpeed) => void;
  isSpeaking: boolean;
  onPreview: (voice: SpeechSynthesisVoice, speed?: SpeechSpeed) => void;
  onStopPreview: () => void;
}

export function VoiceSelectionDialog({
  open,
  onContinue,
  onSkip,
  availableVoices,
  selectedVoice,
  onSelectVoice,
  speed,
  onSpeedChange,
  isSpeaking,
  onPreview,
  onStopPreview,
}: VoiceSelectionDialogProps) {
  const [previewingVoiceName, setPreviewingVoiceName] = useState<string | null>(null);

  // Group voices: English first, then others
  const groupedVoices = useMemo(() => {
    const english: SpeechSynthesisVoice[] = [];
    const other: SpeechSynthesisVoice[] = [];
    availableVoices.forEach(v => {
      if (v.lang.startsWith('en')) english.push(v);
      else other.push(v);
    });
    return { english, other };
  }, [availableVoices]);

  // Stop preview when dialog closes
  useEffect(() => {
    if (!open) {
      onStopPreview();
      setPreviewingVoiceName(null);
    }
  }, [open, onStopPreview]);

  // Reset previewing state when speech ends
  useEffect(() => {
    if (!isSpeaking) setPreviewingVoiceName(null);
  }, [isSpeaking]);

  const handlePreview = (voice: SpeechSynthesisVoice) => {
    if (isSpeaking && previewingVoiceName === voice.name) {
      onStopPreview();
      setPreviewingVoiceName(null);
    } else {
      setPreviewingVoiceName(voice.name);
      onPreview(voice, speed);
    }
  };

  const handleSelectAndPreview = (voice: SpeechSynthesisVoice) => {
    onSelectVoice(voice);
  };

  const renderVoiceList = (voices: SpeechSynthesisVoice[], label: string) => {
    if (voices.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">{label}</h4>
        <div className="space-y-1">
          {voices.map(voice => {
            const isSelected = selectedVoice?.name === voice.name;
            const isPreviewing = isSpeaking && previewingVoiceName === voice.name;
            return (
              <div
                key={voice.name}
                onClick={() => handleSelectAndPreview(voice)}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                    : 'bg-card hover:bg-muted/50 border-transparent hover:border-border'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    {isSelected ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {voice.name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {voice.lang}
                      </Badge>
                      {voice.default && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Default
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 w-8 p-0 flex-shrink-0 ${isPreviewing ? 'text-accent' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(voice);
                  }}
                >
                  {isPreviewing ? (
                    <Square className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b bg-gradient-to-br from-primary/5 to-accent/5">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <Volume2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">Reading Assistant Setup</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Choose a voice and speed for reading questions aloud
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Speed Selector */}
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Reading Speed</p>
            <div className="flex items-center bg-muted/60 rounded-xl border border-border/50 overflow-hidden w-fit">
              {(['slow', 'normal', 'fast'] as SpeechSpeed[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onSpeedChange(s)}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    speed === s
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s === 'slow' ? '0.5×' : s === 'normal' ? '1×' : '1.5×'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Voice List */}
        <ScrollArea className="flex-1 min-h-0 max-h-[40vh]">
          <div className="p-4 space-y-4">
            {availableVoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mic className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No voices available on this device</p>
              </div>
            ) : (
              <>
                {renderVoiceList(groupedVoices.english, 'English Voices')}
                {renderVoiceList(groupedVoices.other, 'Other Languages')}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
            <SkipForward className="h-4 w-4 mr-1.5" />
            Skip
          </Button>
          <Button onClick={onContinue} className="gap-2">
            Continue to Exam
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
