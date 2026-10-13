import { useCallback, useRef, useState } from 'react';

interface SlotAdjustment {
  slotIndex: number;
  panX: number;
  panY: number;
  scale: number;
}

interface DraggablePhotoCellProps {
  photo: string;
  slotIndex: number;
  adjustment?: SlotAdjustment;
  onAdjust: (slotIndex: number, panX: number, panY: number, scale: number) => void;
  className?: string;
}

export function DraggablePhotoCell({ photo, slotIndex, adjustment, onAdjust, className = '' }: DraggablePhotoCellProps) {
  const panX = adjustment?.panX ?? 0;
  const panY = adjustment?.panY ?? 0;
  const scale = adjustment?.scale ?? 1;

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const clampPan = useCallback((px: number, py: number, s: number) => {
    const maxPan = Math.max(0, (s - 1) / s);
    return {
      panX: Math.max(-maxPan, Math.min(maxPan, px)),
      panY: Math.max(-maxPan, Math.min(maxPan, py)),
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, panX, panY };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStart.current.x) / rect.width;
    const dy = (e.clientY - dragStart.current.y) / rect.height;
    const clamped = clampPan(dragStart.current.panX + dx * 2, dragStart.current.panY + dy * 2, scale);
    onAdjust(slotIndex, clamped.panX, clamped.panY, scale);
  };

  const onPointerUp = () => {
    dragStart.current = null;
    setDragging(false);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.max(1, Math.min(3, scale + delta));
    const clamped = clampPan(panX, panY, newScale);
    onAdjust(slotIndex, clamped.panX, clamped.panY, newScale);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStart.current = { dist: Math.hypot(dx, dy), scale };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const newScale = Math.max(1, Math.min(3, pinchStart.current.scale * (dist / pinchStart.current.dist)));
      const clamped = clampPan(panX, panY, newScale);
      onAdjust(slotIndex, clamped.panX, clamped.panY, newScale);
    }
  };

  const onTouchEnd = () => {
    pinchStart.current = null;
  };

  return (
    <div
      ref={containerRef}
      className={`photo-cell tone-${slotIndex % 4} ${className}`}
      style={{ touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {photo ? (
        <img
          src={photo}
          alt={`Frame ${slotIndex + 1}`}
          draggable={false}
          className="pointer-events-none h-full w-full object-cover"
          style={{
            transform: `translate(${panX * 50}%, ${panY * 50}%) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      ) : (
        <div className="silhouette" aria-label={`Frame ${slotIndex + 1} waiting`}><span /></div>
      )}
    </div>
  );
}
