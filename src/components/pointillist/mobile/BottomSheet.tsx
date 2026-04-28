'use client';

import { useEffect, useRef } from 'react';

interface BottomSheetProps {
  isOpen:   boolean;
  onClose:  () => void;
  title:    string;
  children: React.ReactNode;
  /** Max height of the sheet as a CSS value. Default '80dvh'. */
  maxHeight?: string;
}

/**
 * Animated slide-up bottom drawer.
 *
 * - Slides in from the bottom with a cubic-bezier spring feel.
 * - Backdrop tap closes it.
 * - Locks body scroll while open to prevent background scroll on iOS.
 * - Content area is independently scrollable with overscroll-contain.
 */
export function BottomSheet({ isOpen, onClose, title, children, maxHeight = '80dvh' }: BottomSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Lock body scroll on open — prevents iOS rubber-band scroll behind sheet
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     40,
          background: 'rgba(0,0,0,0.65)',
          opacity:    isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 280ms ease',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position:    'fixed',
          bottom:      0,
          left:        0,
          right:       0,
          zIndex:      50,
          maxHeight,
          display:     'flex',
          flexDirection: 'column',
          background:  '#131313',
          borderTop:   '1px solid #2a2a2a',
          borderRadius: '18px 18px 0 0',
          transform:   isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition:  'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333333' }} />
        </div>

        {/* Title bar */}
        <div
          style={{
            display:       'flex',
            alignItems:    'center',
            justifyContent: 'space-between',
            padding:       '10px 20px 14px',
            flexShrink:    0,
            borderBottom:  '1px solid #1e1e1e',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              width:        32,
              height:       32,
              borderRadius: 8,
              background:   '#1e1e1e',
              border:       '1px solid #2a2a2a',
              color:        '#888888',
              fontSize:     18,
              lineHeight:   '1',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              cursor:       'pointer',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div
          ref={contentRef}
          style={{
            flex:              1,
            overflowY:         'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}
        >
          {children}
        </div>
      </div>
    </>
  );
}
