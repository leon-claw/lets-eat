import { useState } from 'react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
}

export function ImageWithFallback({ src, alt, className = '' }: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

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

  if (hasError) {
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

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      referrerPolicy="no-referrer"
    />
  );
}
