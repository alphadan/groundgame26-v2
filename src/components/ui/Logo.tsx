// src/components/ui/Logo.tsx
import LogoSVG from "../../assets/icons/logo4.svg?react";

type LogoProps = {
  className?: string;
  width?: number | string;
  height?: number | string;
};

export default function Logo({
  className = "",
  width = 160,
  height = 60,
}: LogoProps) {
  // 2. Now LogoSVG is a true React Component, not a string path.
  return <LogoSVG className={className} width={width} height={height} />;
}
