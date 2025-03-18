import { cn } from "@/utils/utils";
import { env } from "env";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import Media from "../modules/realms/media";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({
  content,
  _className,
}: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      //className={cn("prose dark:prose-invert max-w-none", className)}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSanitize]}
      urlTransform={(url) => {
        console.log("ReactMarkdown URL transform called with:", url);
        if (url.startsWith("ipfs://")) {
          const transformed = url.replace(
            "ipfs://",
            env.VITE_PUBLIC_IPFS_GATEWAY ?? "",
          );
          console.log("URL transformed to:", transformed);
          return transformed;
        }
        return url;
      }}
      components={{
        h1: ({ _node, ...props }) => (
          <h1
            className="mb-4 mt-6 scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-3xl"
            {...props}
          />
        ),
        h2: ({ _node, ...props }) => (
          <h2
            className="mb-4 mt-6 scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0"
            {...props}
          />
        ),
        h3: ({ _node, ...props }) => (
          <h3
            className="mb-4 mt-6 scroll-m-20 text-xl font-semibold tracking-tight"
            {...props}
          />
        ),
        h4: ({ _node, ...props }) => (
          <h4
            className="mb-4 mt-6 scroll-m-20 text-lg font-semibold tracking-tight"
            {...props}
          />
        ),
        p: ({ _node, ...props }) => (
          <p className="mb-4 leading-7 [&:not(:first-child)]:mt-6" {...props} />
        ),
        a: ({ _node, ...props }) => (
          <a
            className="text-primary hover:text-primary/80 font-medium underline underline-offset-4"
            {...props}
          />
        ),
        blockquote: ({ _node, ...props }) => (
          <blockquote
            className="border-muted mt-6 border-l-2 pl-6 italic"
            {...props}
          />
        ),
        ul: ({ _node, ...props }) => (
          <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props} />
        ),
        ol: ({ _node, ...props }) => (
          <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...props} />
        ),
        li: ({ _node, ...props }) => <li {...props} />,
        table: ({ _node, ...props }) => (
          <div className="my-6 w-full overflow-y-auto">
            <table className="w-full border-collapse text-sm" {...props} />
          </div>
        ),
        thead: ({ _node, ...props }) => <thead {...props} />,
        tbody: ({ _node, ...props }) => <tbody {...props} />,
        tr: ({ _node, ...props }) => (
          <tr className="even:bg-muted m-0 border-t p-0" {...props} />
        ),
        th: ({ _node, ...props }) => (
          <th
            className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right"
            {...props}
          />
        ),
        td: ({ _node, ...props }) => (
          <td
            className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right"
            {...props}
          />
        ),
        hr: ({ _node, ...props }) => <hr className="my-4 md:my-8" {...props} />,
        img: ({ _node, alt, src, ...props }) => {
          console.log("MarkdownRenderer img:", { src, alt });
          if (!src) {
            console.warn("Image source is undefined!");
            return null;
          }
          return (
            <Media
              src={src}
              className="mx-auto rounded-md border"
              alt={alt || "Markdown image"}
              {...props}
            />
          );
        },
        code: ({ _node, inline, _className, children, ...props }: any) => {
          if (inline) {
            return (
              <code
                className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <pre className="mb-4 mt-6 overflow-x-auto rounded-lg border bg-black p-4">
              <code
                className="relative font-mono text-sm text-white"
                {...props}
              >
                {children}
              </code>
            </pre>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
