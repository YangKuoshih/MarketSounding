interface JarrettAvatarProps {
  size?: number;
  className?: string;
}

export function JarrettAvatar({ size = 28, className = "" }: JarrettAvatarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle — sky blue matching brand primary */}
      <circle cx="16" cy="16" r="16" fill="#0284c7" />
      {/* Body — rounded oval */}
      <ellipse cx="16" cy="18" rx="5.5" ry="6.5" fill="white" />
      {/* Stripes */}
      <rect x="10.5" y="16.5" width="11" height="2" rx="1" fill="#0284c7" />
      <rect x="10.5" y="19.5" width="11" height="2" rx="1" fill="#0284c7" />
      {/* Head */}
      <circle cx="16" cy="10.5" r="3.5" fill="white" />
      {/* Eyes */}
      <circle cx="14.6" cy="10" r="0.9" fill="#0284c7" />
      <circle cx="17.4" cy="10" r="0.9" fill="#0284c7" />
      {/* Antennae */}
      <line x1="14.5" y1="7.2" x2="12" y2="4.5" stroke="white" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="11.5" cy="4" r="1" fill="white" />
      <line x1="17.5" y1="7.2" x2="20" y2="4.5" stroke="white" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="20.5" cy="4" r="1" fill="white" />
      {/* Left wing */}
      <ellipse cx="9" cy="14" rx="4" ry="2.5" fill="white" fillOpacity="0.85" transform="rotate(-20 9 14)" />
      {/* Right wing */}
      <ellipse cx="23" cy="14" rx="4" ry="2.5" fill="white" fillOpacity="0.85" transform="rotate(20 23 14)" />
      {/* Stinger */}
      <path d="M16 24.5 L14.5 27 L16 26.2 L17.5 27 Z" fill="white" />
    </svg>
  );
}
