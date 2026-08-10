import { useEffect, useRef } from 'react';

interface HtmlPreviewProps {
  code: string;
  /** Bumped by the parent to force a fresh reload (a fresh iframe = a clean JS/DOM state each run). */
  runToken: number;
  onConsoleOutput?: (lines: string[]) => void;
}

// Injected into the iframe so console.log/warn/error from student code are
// captured and relayed to the parent for the "output" panel, since a sandboxed
// iframe's console doesn't otherwise surface anywhere the student can see it.
const CONSOLE_BRIDGE = `
<script>
  (function () {
    const send = (level, args) => {
      try {
        parent.postMessage({ __codingPreview: true, level, message: args.map(a => {
          try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
        }).join(' ') }, '*');
      } catch (e) {}
    };
    ['log', 'warn', 'error', 'info'].forEach((level) => {
      const original = console[level];
      console[level] = function (...args) { send(level, args); original.apply(console, args); };
    });
    window.addEventListener('error', (e) => send('error', [e.message + ' (line ' + e.lineno + ')']));
  })();
</script>
`;

/**
 * Runs student HTML/CSS/JS in a sandboxed iframe. `sandbox="allow-scripts"`
 * WITHOUT `allow-same-origin` is deliberate: it keeps the student's script
 * running in a distinct opaque origin so it cannot reach into the parent
 * app, read cookies/localStorage, or make authenticated requests as the
 * logged-in user, even though it can still execute freely for the preview.
 */
export function HtmlPreview({ code, runToken, onConsoleOutput }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.__codingPreview && onConsoleOutput) {
        onConsoleOutput([`[${e.data.level}] ${e.data.message}`]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onConsoleOutput]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = code.includes('<html') ? code : `<!DOCTYPE html><html><head></head><body>${code}</body></html>`;
    const withBridge = doc.includes('</body>')
      ? doc.replace('</body>', `${CONSOLE_BRIDGE}</body>`)
      : doc + CONSOLE_BRIDGE;
    iframe.srcdoc = withBridge;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runToken]);

  return (
    <iframe
      ref={iframeRef}
      title="Code preview"
      sandbox="allow-scripts"
      className="w-full h-full bg-white rounded-lg border border-border/50"
    />
  );
}
