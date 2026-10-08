import React from 'react';

interface EqualizerProps {
  isPlaying: boolean;
  className?: string;
  barColor?: string;
}

export const Equalizer: React.FC<EqualizerProps> = ({
  isPlaying,
  className = 'w-4 h-4',
  barColor = 'bg-[#1ed760]'
}) => {
  return (
    <div className={`flex items-end justify-center gap-[2.5px] ${className}`}>
      <span
        className={`w-[2.5px] rounded-full transition-all duration-300 ${barColor} ${
          isPlaying ? 'animate-eq-1' : 'h-[3px]'
        }`}
      />
      <span
        className={`w-[2.5px] rounded-full transition-all duration-300 ${barColor} ${
          isPlaying ? 'animate-eq-2' : 'h-[6px]'
        }`}
      />
      <span
        className={`w-[2.5px] rounded-full transition-all duration-300 ${barColor} ${
          isPlaying ? 'animate-eq-3' : 'h-[10px]'
        }`}
      />
      <span
        className={`w-[2.5px] rounded-full transition-all duration-300 ${barColor} ${
          isPlaying ? 'animate-eq-4' : 'h-[4px]'
        }`}
      />
    </div>
  );
};
