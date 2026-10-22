"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

type Flame = {
  left: number;
  size: number;
  delay: number;
  duration: number;
  rise: number;
  sway: number;
  hue: "core" | "mid" | "outer";
};

const palettes = {
  core: "radial-gradient(circle at 50% 70%, #fff7c2 0%, #ffd23f 45%, rgba(255,140,0,0) 72%)",
  mid: "radial-gradient(circle at 50% 70%, #ffd23f 0%, #ff8a00 50%, rgba(230,60,0,0) 75%)",
  outer: "radial-gradient(circle at 50% 70%, #ff8a00 0%, #e8410f 50%, rgba(160,20,0,0) 78%)",
};

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

/** A short burst of flames and embers, played once when it mounts (give it a new key to replay). */
export function FireBurst({ seed = 1, height = 150 }: { seed?: number; height?: number }) {
  const reduceMotion = useReducedMotion();

  const { flames, embers } = useMemo(() => {
    const random = seeded(seed);
    const flames: Flame[] = Array.from({ length: 22 }, (_, index) => {
      const hue = index % 3 === 0 ? "core" : index % 3 === 1 ? "mid" : "outer";
      return {
        left: 8 + random() * 84,
        size: (hue === "core" ? 14 : hue === "mid" ? 20 : 26) + random() * 14,
        delay: random() * 0.45,
        duration: 0.85 + random() * 0.6,
        rise: height * (0.45 + random() * 0.55),
        sway: (random() - 0.5) * 26,
        hue,
      };
    });
    const embers = Array.from({ length: 12 }, () => ({
      left: 10 + random() * 80,
      delay: 0.15 + random() * 0.6,
      duration: 1.1 + random() * 0.7,
      rise: height * (0.8 + random() * 0.6),
      drift: (random() - 0.5) * 60,
    }));
    return { flames, embers };
  }, [seed, height]);

  if (reduceMotion) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-40 overflow-visible" style={{ height }}>
      {/* warm glow at the base */}
      <motion.div
        className="absolute inset-x-[-20%] bottom-[-10px] h-16 rounded-full"
        style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(255,150,30,0.55), rgba(255,90,0,0) 70%)" }}
        initial={{ opacity: 0, scaleY: 0.4 }}
        animate={{ opacity: [0, 1, 0.8, 0], scaleY: [0.4, 1.2, 1, 0.6] }}
        transition={{ duration: 1.6, ease: "easeOut" }}
      />
      {flames.map((flame, index) => (
        <motion.span
          key={`flame-${index}`}
          className="absolute bottom-0 block"
          style={{
            left: `${flame.left}%`,
            width: flame.size,
            height: flame.size * 1.35,
            marginLeft: -flame.size / 2,
            background: palettes[flame.hue],
            borderRadius: "50% 50% 45% 45% / 62% 62% 38% 38%",
            filter: "blur(0.6px)",
          }}
          initial={{ opacity: 0, y: 0, scale: 0.5, x: 0 }}
          animate={{
            opacity: [0, 1, 0.9, 0],
            y: [0, -flame.rise * 0.45, -flame.rise],
            x: [0, flame.sway, -flame.sway * 0.4],
            scale: [0.5, 1.15, 0.35],
          }}
          transition={{ duration: flame.duration, delay: flame.delay, ease: "easeOut" }}
        />
      ))}
      {embers.map((ember, index) => (
        <motion.span
          key={`ember-${index}`}
          className="absolute bottom-2 block h-[3px] w-[3px] rounded-full bg-[#ffd23f]"
          style={{ left: `${ember.left}%`, boxShadow: "0 0 6px 1px rgba(255,170,40,0.9)" }}
          initial={{ opacity: 0, y: 0, x: 0 }}
          animate={{ opacity: [0, 1, 1, 0], y: -ember.rise, x: ember.drift }}
          transition={{ duration: ember.duration, delay: ember.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
