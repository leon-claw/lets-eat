import { useEffect, useState } from 'react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}

export function ImageWithFallback({ src, alt, className = '', fallbackSrc }: ImageWithFallbackProps) {
  const [imageState, setImageState] = useState<'primary' | 'fallback' | 'error'>('primary');

  useEffect(() => {
    setImageState('primary');
  }, [fallbackSrc, src]);

  if (!src) {
    return (
      <div
        role="img"
        aria-label={alt}
        data-image-state="empty"
        className={`flex min-h-48 items-center justify-center bg-stone-100 text-sm font-semibold text-stone-400 ${className}`}
      >
        图片待补充
      </div>
    );
  }

  if (imageState === 'error') {
    return (
      <div
        role="img"
        aria-label={alt}
        data-image-state="error"
        className={`flex min-h-48 items-center justify-center bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 text-sm font-semibold text-amber-900 ${className}`}
      >
        图片暂不可用
      </div>
    );
  }

  const displayedSrc = imageState === 'fallback' && fallbackSrc ? fallbackSrc : src;
  return (
    <img
      src={displayedSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (displayedSrc === src && fallbackSrc && fallbackSrc !== src) setImageState('fallback');
        else setImageState('error');
      }}
      referrerPolicy="no-referrer"
    />
  );
}
