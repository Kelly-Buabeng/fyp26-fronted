'use client';
import { useState } from 'react';
import type { DetectionItem } from '../../../lib/api/types';
import { c } from '../../../lib/styles';
import { severity, severityColors } from '../../../lib/format';
export function ImagePreview({
  src,
  detections = [],
}: {
  src: string;
  detections?: DetectionItem[];
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <div className={c('frame')}>
      {/* Local upload previews use blob URLs and natural pixel dimensions. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Uploaded road image"
        onLoad={(e) =>
          setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
        }
        className={c('preview-image')}
      />
      {size.width > 0 && detections.length > 0 && (
        <svg
          className={c('box-overlay')}
          viewBox={`0 0 ${size.width} ${size.height}`}
          aria-label={`${detections.length} detected potholes`}
          role="img"
        >
          {detections.map((d, i) => {
            const color = severityColors[severity(d.confidence)];
            const x = Math.max(0, d.bbox.x1),
              y = Math.max(0, d.bbox.y1),
              w = Math.max(0, Math.min(size.width, d.bbox.x2) - x),
              h = Math.max(0, Math.min(size.height, d.bbox.y2) - y);
            const font = Math.max(12, size.width / 55);
            const labelY = Math.max(font * 1.8, y);
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  stroke={color}
                  strokeWidth={Math.max(2, size.width / 320)}
                  fill={color}
                  fillOpacity=".12"
                />
                <rect
                  x={x}
                  y={labelY - font * 1.8}
                  width={Math.min(size.width - x, font * 13)}
                  height={font * 1.8}
                  fill={color}
                />
                <text
                  x={x + font * 0.4}
                  y={labelY - font * 0.45}
                  fill="#fbfcfd"
                  fontSize={font}
                  fontFamily="monospace"
                >
                  {d.label} {Math.round(d.confidence * 100)}%
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
