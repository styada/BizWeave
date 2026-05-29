"use client";

export function SitePreview({ html, css }: { html: string; css: string }) {
  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
      <iframe
        title="Generated site preview"
        srcDoc={srcDoc}
        className="h-[600px] w-full border-0"
        sandbox="allow-same-origin"
      />
    </div>
  );
}
