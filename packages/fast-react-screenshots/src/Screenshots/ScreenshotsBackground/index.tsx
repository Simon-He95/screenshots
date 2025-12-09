import React, {
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import useBounds from '../hooks/useBounds'
import useStore from '../hooks/useStore'
import ScreenshotsMagnifier from '../ScreenshotsMagnifier'
import { Point, Position } from '../types'
import getBoundsByPoints from './getBoundsByPoints'
import './index.less'

export default memo(function ScreenshotsBackground (): ReactElement | null {
  const {
    image, imageWidth, imageHeight, width, height
  } = useStore()
  const [bounds, boundsDispatcher] = useBounds()

  const elRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointRef = useRef<Point | null>(null)
  // 用来判断鼠标是否移动过
  // 如果没有移动过位置，则mouseup时不更新
  const isMoveRef = useRef<boolean>(false)
  const [position, setPosition] = useState<Position | null>(null)

  const updateBounds = useCallback(
    (p1: Point, p2: Point) => {
      if (!elRef.current) {
        return
      }
      const { x, y } = elRef.current.getBoundingClientRect()

      boundsDispatcher.set(
        getBoundsByPoints(
          {
            x: p1.x - x,
            y: p1.y - y
          },
          {
            x: p2.x - x,
            y: p2.y - y
          },
          width,
          height
        )
      )
    },
    [width, height, boundsDispatcher]
  )

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // e.button 鼠标左键
      if (pointRef.current || bounds || e.button !== 0) {
        return
      }
      pointRef.current = {
        x: e.clientX,
        y: e.clientY
      }
      isMoveRef.current = false
    },
    [bounds]
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (elRef.current) {
        const rect = elRef.current.getBoundingClientRect()
        if (e.clientX < rect.left || e.clientY < rect.top || e.clientX > rect.right || e.clientY > rect.bottom) {
          setPosition(null)
        } else {
          setPosition({
            x: e.clientX - rect.x,
            y: e.clientY - rect.y
          })
        }
      }

      if (!pointRef.current) {
        return
      }
      updateBounds(pointRef.current, {
        x: e.clientX,
        y: e.clientY
      })
      isMoveRef.current = true
    }

    const onMouseUp = (e: MouseEvent) => {
      if (!pointRef.current) {
        return
      }

      if (isMoveRef.current) {
        updateBounds(pointRef.current, {
          x: e.clientX,
          y: e.clientY
        })
      }
      pointRef.current = null
      isMoveRef.current = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [updateBounds])

  useLayoutEffect(() => {
    if (!image || bounds) {
      // 重置位置
      setPosition(null)
    }
  }, [image, bounds])

  const drawBackground = useCallback(() => {
    if (!canvasRef.current || !image) {
      return
    }
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'low'
    ctx.clearRect(0, 0, width, height)
    const sourceWidth = imageWidth || width
    const sourceHeight = imageHeight || height
    ctx.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height)
  }, [image, imageWidth, imageHeight, width, height])

  useEffect(() => {
    drawBackground()
  }, [drawBackground])

  // 没有加载完不显示图片
  if (!image) {
    return null
  }

  return (
    <div ref={elRef} className='screenshots-background' onMouseDown={onMouseDown}>
      <canvas ref={canvasRef} className='screenshots-background-canvas' />
      <div className='screenshots-background-mask' />
      {position && !bounds && <ScreenshotsMagnifier x={position?.x} y={position?.y} />}
    </div>
  )
})
