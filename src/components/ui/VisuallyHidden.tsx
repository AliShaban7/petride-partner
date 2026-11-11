import type { ElementType, ReactNode } from "react";

/** Text for screen readers only (e.g. table captions, icon labels, chart summaries). */
export function VisuallyHidden({ children, as: Tag = "span" }: { children: ReactNode; as?: ElementType }) {
  return <Tag className="sr-only">{children}</Tag>;
}
