'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Rnd } from 'react-rnd'

interface Props {
  children: React.ReactNode
  onLukk: () => void
  defaultWidth?: number
  defaultHeight?: number
  minWidth?: number
  minHeight?: number
  zIndex?: number
}

export default function DraggableModal({
  children,
  onLukk,
  defaultWidth = 672,
  defaultHeight = 680,
  minWidth = 400,
  minHeight = 300,
  zIndex = 50,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const computeLayout = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const pad = 32
    const vw = el.clientWidth
    const vh = el.clientHeight
    const w = Math.min(defaultWidth, vw - pad)
    const h = Math.min(defaultHeight, vh - pad)
    const x = Math.max(pad / 2, Math.round(vw / 2 - w / 2))
    const y = Math.max(pad / 2, Math.round(vh / 2 - h / 2))
    setLayout({ x, y, w, h })
  }, [defaultWidth, defaultHeight])

  useEffect(() => {
    computeLayout()
  }, [computeLayout])

  if (!layout) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        style={{ zIndex }}
        onClick={onLukk}
      />

      {/* Draggable + resizable vindu */}
      <div ref={containerRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: zIndex + 1 }}>
        <Rnd
          default={{ x: layout.x, y: layout.y, width: layout.w, height: layout.h }}
          minWidth={minWidth}
          minHeight={minHeight}
          bounds="parent"
          dragHandleClassName="modal-drag-handle"
          style={{ pointerEvents: 'auto' }}
          enableResizing={{
            top: false, right: false, bottom: true,
            left: false, topRight: false, bottomRight: true,
            bottomLeft: false, topLeft: false,
          }}
          resizeHandleStyles={{
            bottom: { height: 8, bottom: -4 },
            bottomRight: { width: 16, height: 16, right: -4, bottom: -4 },
          }}
        >
          <div
            className="w-full h-full bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {children}
          </div>
        </Rnd>
      </div>
    </>
  )
}
