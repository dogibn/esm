import Image from "next/image"

import { cn } from "@/lib/utils"

type LogoProps = {
  width: number
  height: number
  className?: string
}

export function Logo({ width, height, className }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="English School of Mongolia"
      width={width}
      height={height}
      className={cn(className)}
      priority
    />
  )
}
