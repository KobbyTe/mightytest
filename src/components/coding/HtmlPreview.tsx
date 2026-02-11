import { useEffect, useRef } from 'react';

interface HtmlPreviewProps {
  code: string;
}

export default function HtmlPreview({ code }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(code);
        doc.close();
      }
    }
  }, [code]);

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-white">
      <div className="bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground border-b">
        Preview
      </div>
      <iframe
        ref={iframeRef}
        title="HTML Preview"
        sandbox="allow-scripts"
        className="w-full h-[300px] bg-white"
      />
    </div>
  );
}
