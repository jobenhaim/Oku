
import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = "", size = 80 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logo-tl" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8BA6E" />
          <stop offset="100%" stopColor="#B78B4D" />
        </linearGradient>
        <linearGradient id="logo-tr" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F0F0F0" />
          <stop offset="100%" stopColor="#C0C0C0" />
        </linearGradient>
        <linearGradient id="logo-bl" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B8D3F5" />
          <stop offset="100%" stopColor="#79A6E3" />
        </linearGradient>
        <linearGradient id="logo-br" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B8DBBE" />
          <stop offset="100%" stopColor="#8CB794" />
        </linearGradient>
      </defs>
      
      {/* Background - White Rounded Square */}
      <rect width="100" height="100" rx="22" fill="#ffffff" />
      
      {/* Top Left - Gold */}
      <rect x="9" y="9" width="38" height="38" rx="12" fill="url(#logo-tl)" />
      
      {/* Top Right - Silver */}
      <rect x="53" y="9" width="38" height="38" rx="12" fill="url(#logo-tr)" />
      
      {/* Bottom Left - Blue */}
      <rect x="9" y="53" width="38" height="38" rx="12" fill="url(#logo-bl)" />
      
      {/* Bottom Right - Green */}
      <rect x="53" y="53" width="38" height="38" rx="12" fill="url(#logo-br)" />
    </svg>
  );
};
