import React, { useMemo, useState } from 'react';

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallback?: React.ReactNode;
}

/**
 * Stable image renderer:
 * - Encodes local paths containing Chinese/special chars
 * - Falls back gracefully when loading fails
 */
const SafeImage: React.FC<SafeImageProps> = ({ src, fallback = null, onError, ...imgProps }) => {
  const [failed, setFailed] = useState(false);

  const normalizedSrc = useMemo(() => {
    if (!src) return null;
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:')) {
      return src;
    }
    return encodeURI(src);
  }, [src]);

  if (!normalizedSrc || failed) {
    return <>{fallback}</>;
  }

  return (
    <img
      {...imgProps}
      src={normalizedSrc}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
};

export default SafeImage;
