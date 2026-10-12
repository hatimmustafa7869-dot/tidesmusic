import React from 'react';

interface EqualizerProps {
  isPlaying: boolean;
  className?: string;
  barColor?: string;
  variant?: 'compact' | 'futuristic';
}

export const Equalizer: React.FC<EqualizerProps> = ({
  isPlaying,
  className = 'w-4 h-4',
  barColor,
  variant = 'compact'
}) => {
  if (variant === 'futuristic') {
    return (
      <div className={`flex items-end justify-center gap-[3px] h-5 ${className}`}>
        <span
          className={`w-[3px] rounded-full transition-all duration-300 bg-gradient-to-t from-[#00f2fe] to-[#1ed760] shadow-[0_0_8px_rgba(0,242,254,0.6)] ${
            isPlaying ? 'animate-band-1' : 'h-[4px]'
          }`}
        />
        <span
          className={`w-[3px] rounded-full transition-all duration-300 bg-gradient-to-t from-[#00f2fe] to-[#1ed760] shadow-[0_0_8px_rgba(0,242,254,0.6)] ${
            isPlaying ? 'animate-band-2' : 'h-[7px]'
          }`}
        />
        <span
          className={`w-[3px] rounded-full transition-all duration-300 bg-gradient-to-t from-[#00f2fe] to-[#1ed760] shadow-[0_0_8px_rgba(0,242,254,0.6)] ${
            isPlaying ? 'animate-band-3' : 'h-[12px]'
          }`}
        />
        <span
          className={`w-[3px] rounded-full transition-all duration-300 bg-gradient-to-t from-[#00f2fe] to-[#1ed760] shadow-[0_0_8px_rgba(0,242,254,0.6)] ${
            isPlaying ? 'animate-band-4' : 'h-[6px]'
          }`}
        />
        <span
          className={`w-[3px] rounded-full transition-all duration-300 bg-gradient-to-t from-[#00f2fe] to-[#1ed760] shadow-[0_0_8px_rgba(0,242,254,0.6)] ${
            isPlaying ? 'animate-band-5' : 'h-[4px]'
          }`}
        />
      </div>
    );
  }

  const defaultColor = barColor || 'bg-gradient-to-t from-[#00f2fe] to-[#1ed760]';

  return (
    <div className={`flex items-end justify-center gap-[2.5px] ${className}`}>
      <span
        className={`w-[2.5px] rounded-full transition-all duration-300 ${defaultColor} shadow-[0_0_6px_rgba(30,215,96,0.4)] ${
          isPlaying ? 'animate-eq-1' : 'h-[3px]'
        }`}
      />
      <span
        className={`w-[2.5px] rounded-full transition-all duration-300 ${defaultColor} shadow-[0_0_6px_rgba(30,215,96,0.4)] ${
          isPlaying ? 'animate-eq-2' : 'h-[6px]'
        }`}
      />
      <span
        className={`w-[2.5px] rounded-full transition-all duration-300 ${defaultColor} shadow-[0_0_6px_rgba(30,215,96,0.4)] ${
          isPlaying ? 'animate-eq-3' : 'h-[10px]'
        }`}
      />
      <span
        className={`w-[2.5px] rounded-full transition-all duration-300 ${defaultColor} shadow-[0_0_6px_rgba(30,215,96,0.4)] ${
          isPlaying ? 'animate-eq-4' : 'h-[4px]'
        }`}
      />
    </div>
  );
};
