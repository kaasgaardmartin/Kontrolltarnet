'use client'

import { useEffect, useState } from 'react'
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
  const [initial, setInitial] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const x = Math.max(16, Math.round(window.innerWidth / 2 - defaultWidth / 2))
    const y = Math.max(16, Math.round(window.innerHeight / 2 - defaultHeight / 2))
    setInitial({ x, y })
  }, [defaultWidth, defaultHeight])

  if (!initial) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        style={{ zIndex }}
        onClick={onLukk}
      />

      {/* Draggable + resizable vindu */}
      <Rnd
        default={{ x: initial.x, y: initial.y, width: defaultWidth, height: defaultHeight }}
        minWidth={minWidth}
        minHeight={minHeight}
        bounds="window"
        dragHandleClassName="modal-drag-handle"
        style={{ zIndex: zIndex + 1 }}
        enableResizing={{
          top: false, right: true, bottom: true,
          left: false, topRight: false, bottomRight: true,
          bottomLeft: false, topLeft: false,
        }}
        resizeHandleStyles={{
          right: { width: 8, right: -4 },
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
    </>
  )
}
