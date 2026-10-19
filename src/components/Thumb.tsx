import { useEffect, useRef, useState } from 'react'
import { thumbOf } from '../thumbs'
import type { Sheet } from '../types'

export function Thumb({ sheet, width = 240 }: { sheet: Sheet; width?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let alive = true
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return
      io.disconnect()
      thumbOf(sheet, width).then((u) => alive && setUrl(u)).catch(() => {})
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => {
      alive = false
      io.disconnect()
    }
  }, [sheet.src, sheet.srcIndex, sheet.rot, width]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className="thumb-img" style={{ aspectRatio: `${sheet.width} / ${sheet.height}` }}>
      {url && <img src={url} alt="" draggable={false} />}
    </div>
  )
}
