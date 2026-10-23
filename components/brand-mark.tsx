/** Знак бренду Akin. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="64" height="64" rx="15" fill="#1F1D2E" />
      <path
        d="M18 47 32 17l14 30"
        fill="none"
        stroke="#FAF4ED"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 37h16"
        fill="none"
        stroke="#C4A7E7"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
