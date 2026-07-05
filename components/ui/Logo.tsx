
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
      {/* Background - White Rounded Square */}
      <rect width="100" height="100" rx="22" fill="#ffffff" />
      
      {/* Top-Left Curve */}
      <path 
        d="M 35 0 L 35 27 A 8 8 0 0 1 27 35 L 0 35" 
        stroke="#D2C5B8" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Top-Right Curve */}
      <path 
        d="M 65 0 L 65 27 A 8 8 0 0 0 73 35 L 100 35" 
        stroke="#D2C5B8" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Bottom-Left Curve */}
      <path 
        d="M 0 65 L 27 65 A 8 8 0 0 1 35 73 L 35 100" 
        stroke="#D2C5B8" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Bottom-Right Curve */}
      <path 
        d="M 100 65 L 73 65 A 8 8 0 0 0 65 73 L 65 100" 
        stroke="#D2C5B8" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Center rounded square */}
      <rect 
        x="35" 
        y="35" 
        width="30" 
        height="30" 
        rx="8" 
        stroke="#D2C5B8" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
      
      {/* Letters O K U */}
      <text 
        x="17.5" 
        y="50" 
        fill="#292524" 
        fontSize="26" 
        fontWeight="bold" 
        fontFamily="Outfit, sans-serif" 
        textAnchor="middle" 
        dominantBaseline="central"
      >
        O
      </text>
      <text 
        x="50" 
        y="50" 
        fill="#292524" 
        fontSize="26" 
        fontWeight="bold" 
        fontFamily="Outfit, sans-serif" 
        textAnchor="middle" 
        dominantBaseline="central"
      >
        K
      </text>
      <text 
        x="82.5" 
        y="50" 
        fill="#292524" 
        fontSize="26" 
        fontWeight="bold" 
        fontFamily="Outfit, sans-serif" 
        textAnchor="middle" 
        dominantBaseline="central"
      >
        U
      </text>
    </svg>
  );
};
