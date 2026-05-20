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
      {/* Background circle */}
      <circle cx="16" cy="16" r="16" fill="#1e1b4b" />
      {/* Robot face / head */}
      <rect x="8" y="9" width="16" height="13" rx="3" fill="#4f46e5" />
      {/* Eyes */}
      <circle cx="12.5" cy="14" r="2" fill="#e0e7ff" />
      <circle cx="19.5" cy="14" r="2" fill="#e0e7ff" />
      {/* Pupils */}
      <circle cx="13" cy="14" r="1" fill="#312e81" />
      <circle cx="20" cy="14" r="1" fill="#312e81" />
      {/* Smile */}
      <path d="M12 18.5 Q16 21 20 18.5" stroke="#e0e7ff" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* Antenna */}
      <line x1="16" y1="9" x2="16" y2="6" stroke="#818cf8" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="16" cy="5" r="1.5" fill="#a5b4fc" />
      {/* Ear nubs */}
      <rect x="5.5" y="13" width="2.5" height="4" rx="1.25" fill="#4f46e5" />
      <rect x="24" y="13" width="2.5" height="4" rx="1.25" fill="#4f46e5" />
    </svg>
  );
}
