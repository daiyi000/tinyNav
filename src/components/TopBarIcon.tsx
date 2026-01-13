import { Globe } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function TopBarIcon({
  src,
  fit = "contain",
  sizeClassName = "h-9 w-9"
}: {
  src?: string | null;
  fit?: "contain" | "cover";
  sizeClassName?: string;
}) {
  const iconSrc = useMemo(() => (src ?? "").trim(), [src]);
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [iconSrc]);

  const show = !!iconSrc && !bad;

  return (
    <div
      className={
        "relative overflow-hidden rounded-2xl border border-white/10 " +
        "shadow-[0_6px_18px_rgba(0,0,0,0.14)] dark:shadow-[0_18px_44px_rgba(0,0,0,0.42)] " +
        "bg-black/5 dark:bg-white/6 " +
        "before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/16 before:to-transparent before:opacity-70 " +
        sizeClassName
      }
      aria-hidden
    >
      <div className="absolute inset-0 grid place-items-center overflow-hidden rounded-[inherit] isolate leading-none">
        {show ? (
          fit === "cover" ? (
            <img
              src={iconSrc}
              alt=""
              className="absolute inset-0 block h-full w-full select-none object-cover [image-rendering:auto] scale-[1.01]"
              draggable={false}
              onError={() => setBad(true)}
            />
          ) : (
            <img
              src={iconSrc}
              alt=""
              className="block h-[74%] w-[74%] select-none object-contain [image-rendering:auto]"
              draggable={false}
              onError={() => setBad(true)}
            />
          )
        ) : (
          <Globe size={18} className="text-fg/75" />
        )}
      </div>
    </div>
  );
}

