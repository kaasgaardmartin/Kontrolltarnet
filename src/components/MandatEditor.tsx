'use client'

import { PARTIER } from '@/lib/types'

interface Props {
  mandater: Record<string, number>
  onChange: (mandater: Record<string, number>) => void
  disabled?: boolean
}

export default function MandatEditor({ mandater, onChange, disabled }: Props) {
  const total = Object.values(mandater).reduce((sum, n) => sum + n, 0)

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {PARTIER.map(parti => (
          <div key={parti} className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 w-10">{parti}</label>
            <input
              type="number"
              min={0}
              value={mandater[parti] ?? 0}
              onChange={e => onChange({ ...mandater, [parti]: parseInt(e.target.value) || 0 })}
              disabled={disabled}
              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent text-center disabled:bg-gray-50"
            />
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Totalt: <span className="font-medium">{total}</span> mandater
      </div>
    </div>
  )
}
