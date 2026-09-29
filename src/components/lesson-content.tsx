import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// A TEXT lesson's body, written in Markdown (## titles, lists, **bold**,
// > quotes, tables…). react-markdown never renders raw HTML found in the
// source — a lesson can't inject a script or markup, whatever it contains.
// Plain paragraphs written before Markdown existed still render as
// paragraphs, since a blank line already separates them in both formats.
export function LessonContent({ markdown }: { markdown: string }) {
  return (
    <div className="text-foreground/90 space-y-4 text-[15px] leading-relaxed">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className="mt-8 text-2xl font-semibold first:mt-0">{children}</h2>
          ),
          h2: ({ children }) => (
            <h2 className="mt-8 text-xl font-semibold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 text-lg font-semibold first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1.5 pl-6">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1.5 pl-6">{children}</ol>
          ),
          strong: ({ children }) => (
            <strong className="text-foreground font-semibold">{children}</strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-brand-accent bg-brand-accent/5 rounded-r-lg border-l-4 px-4 py-3">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.9em]">
              {children}
            </code>
          ),
          hr: () => <hr className="border-border my-8" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-border bg-muted border px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-border border px-3 py-2">{children}</td>
          ),
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
