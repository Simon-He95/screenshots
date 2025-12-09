import { useEffect } from 'react'
import useEmiter from './useEmiter'

export default function useCanvasMouseup (onMouseup: (e: MouseEvent) => unknown): void {
  const emiter = useEmiter()

  useEffect(() => {
    emiter.on('mouseup', onMouseup)
    return () => {
      emiter.off('mouseup', onMouseup)
    }
  }, [onMouseup, emiter])
}
