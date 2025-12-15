// src/components/ui/Logo.tsx
import { ReactComponent as LogoSVG } from "../../assets/icons/logo4.svg";

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
  return <LogoSVG className={className} width={width} height={height} />;
}
