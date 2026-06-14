/**
 * MoneyFlow logo mark — a green money-gradient squircle with a white "M"
 * monogram. The same art is the favicon (src/app/icon.svg). Green works on
 * both the light (warm paper) and dark (charcoal) themes, so the mark stays
 * green regardless of color scheme rather than tracking the accent token.
 *
 * `size` is the px dimension of the square mark. Pass `withWordmark` to render
 * the "MoneyFlow" text beside it (used in the app header).
 */
export default function Logo({
  size = 28,
  withWordmark = false,
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={withWordmark ? true : undefined}
      role={withWordmark ? undefined : "img"}
      aria-label={withWordmark ? undefined : "MoneyFlow"}
    >
      <defs>
        <linearGradient id="mf-logo" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop stopColor="#16895C" />
          <stop offset="1" stopColor="#3DDC97" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill="url(#mf-logo)" />
      <path
        d="M132 360 L132 168 L256 300 L380 168 L380 360"
        stroke="#FFFFFF"
        strokeWidth="48"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );

  if (!withWordmark) return mark;

  return (
    <span className="flex items-center gap-2.5">
      {mark}
      <span className="font-display text-lg font-extrabold tracking-tight">MoneyFlow</span>
    </span>
  );
}
