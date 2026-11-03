"use client";

import { useEffect, useMemo, useState } from "react";
import { IP } from "@/lib/ip";
import styles from "./BrandReveal.module.css";

/**
 * Loop: RS → type to RevenShare → erase back to RS.
 * Frames fill between R…S, then grow the Share tail.
 */
function buildFrames(brand: string): string[] {
  const sIdx = brand.indexOf("S", 1);
  if (sIdx <= 0) {
    const frames = [""];
    for (let i = 1; i <= brand.length; i++) frames.push(brand.slice(0, i));
    return frames;
  }

  const leftCore = brand.slice(0, sIdx); // Reven
  const rightTail = brand.slice(sIdx); // Share
  const frames: string[] = [];

  for (let i = 1; i <= leftCore.length; i++) {
    frames.push(leftCore.slice(0, i) + "S");
  }
  for (let i = 2; i <= rightTail.length; i++) {
    frames.push(leftCore + rightTail.slice(0, i));
  }

  return frames;
}

type Props = {
  id?: string;
  className?: string;
};

export function BrandReveal({ id, className }: Props) {
  const full = IP.brand;
  const frames = useMemo(() => buildFrames(full), [full]);
  const last = frames.length - 1;
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduced) return;

    let i = 0;
    let dir: 1 | -1 = 1;
    let pauseUntil = 0;
    setIndex(0);

    const timer = window.setInterval(() => {
      const now = Date.now();
      if (now < pauseUntil) return;

      const next = i + dir;
      if (next >= last) {
        i = last;
        dir = -1;
        pauseUntil = now + 1400;
        setIndex(i);
        return;
      }
      if (next <= 0) {
        i = 0;
        dir = 1;
        pauseUntil = now + 700;
        setIndex(i);
        return;
      }
      i = next;
      setIndex(i);
    }, 120);

    return () => window.clearInterval(timer);
  }, [last, reduced]);

  const text = reduced ? full : (frames[index] ?? "RS");

  return (
    <span
      id={id}
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-label={full}
      role="img"
    >
      <span className={styles.measure} aria-hidden="true">
        {full}
      </span>
      <span className={styles.live} aria-hidden="true">
        {text}
        {!reduced ? <span className={styles.caret} /> : null}
      </span>
    </span>
  );
}
