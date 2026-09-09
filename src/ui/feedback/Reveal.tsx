import * as React from "react";

export interface RevealProps extends Omit<React.HTMLAttributes<HTMLElement>, "style"> {
  index?: number;
  delay?: number;
  as?: React.ElementType;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Staggered entrance. Wrap any block: it fades up after `index × --stagger`. Use `Stagger` to auto-index children. Off under reduced motion via the tokens. */
export function Reveal({ index = 0, as = "div", delay = 0, children, style, ...rest }: RevealProps) {
  const El: React.ElementType = as;
  // Cap the stagger: the eighth item and the twentieth arrive together, so a long screen never trickles in.
  return <El style={{ animation: `zh-fade-up var(--dur-base) var(--ease-out) calc(var(--stagger) * ${Math.min(index, 6)} + ${delay}ms) both`, minWidth: 0, ...style }} {...rest}>{children}</El>;
}

export interface StaggerProps { children?: React.ReactNode; start?: number; gap?: string | number; as?: React.ElementType; style?: React.CSSProperties }

export function Stagger({ children, start = 0, gap, style, as = "div" }: StaggerProps) {
  const El: React.ElementType = as;
  const kids = React.Children.toArray(children);
  return <El style={{ display: "flex", flexDirection: "column", gap, minWidth: 0, ...style }}>{kids.map((c, i) => <Reveal key={(React.isValidElement(c) && c.key) || i} index={start + i}>{c}</Reveal>)}</El>;
}
