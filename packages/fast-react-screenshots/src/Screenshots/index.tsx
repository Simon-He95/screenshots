import React, {
  MouseEvent,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import composeImage from './composeImage'
import './icons/iconfont.less'
import './screenshots.less'
import ScreenshotsBackground from './ScreenshotsBackground'
import ScreenshotsCanvas from './ScreenshotsCanvas'
import ScreenshotsContext from './ScreenshotsContext'
import ScreenshotsOperations from './ScreenshotsOperations'
import { Bounds, Emiter, History, ImageDataPayload } from './types'
import zhCN, { Lang } from './zh_CN'

export interface ScreenshotsProps {
  url?: string
  imageData?: ImageDataPayload
  width: number
  height: number
  lang?: Partial<Lang>
  className?: string
  [key: string]: unknown
}

export default function Screenshots ({ url, imageData, width, height, lang, className, ...props }: ScreenshotsProps): ReactElement {
  const canvasContextRef = useRef<CanvasRenderingContext2D>(null)
  const emiterRef = useRef<Emiter>({})
  const [history, setHistory] = useState<History>({
    index: -1,
    stack: []
  })
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [cursor, setCursor] = useState<string | undefined>('move')
  const [operation, setOperation] = useState<string | undefined>(undefined)
  const [image, setImage] = useState<CanvasImageSource | null>(null)
  const [imageWidth, setImageWidth] = useState(0)
  const [imageHeight, setImageHeight] = useState(0)
  const imageBitmapRef = useRef<ImageBitmap | null>(null)

  const store = {
    url,
    width,
    height,
    image,
    imageWidth,
    imageHeight,
    lang: {
      ...zhCN,
      ...lang
    },
    emiterRef,
    canvasContextRef,
    history,
    bounds,
    cursor,
    operation
  }

  const call = useCallback(
    <T extends unknown[]>(funcName: string, ...args: T) => {
      const func = props[funcName]
      if (typeof func === 'function') {
        func(...args)
      }
    },
    [props]
  )

  const dispatcher = {
    call,
    setHistory,
    setBounds,
    setCursor,
    setOperation
  }

  const classNames = ['screenshots']

  if (className) {
    classNames.push(className)
  }

  const releaseBitmap = () => {
    if (imageBitmapRef.current) {
      imageBitmapRef.current.close()
      imageBitmapRef.current = null
    }
  }

  const assignImage = (nextImage: CanvasImageSource | null, nextWidth: number, nextHeight: number) => {
    releaseBitmap()
    if (typeof ImageBitmap !== 'undefined' && nextImage instanceof ImageBitmap) {
      imageBitmapRef.current = nextImage
    }
    setImage(nextImage)
    setImageWidth(nextWidth)
    setImageHeight(nextHeight)
  }

  const reset = () => {
    emiterRef.current = {}
    setHistory({
      index: -1,
      stack: []
    })
    setBounds(null)
    setCursor('move')
    setOperation(undefined)
    assignImage(null, 0, 0)
  }

  useEffect(() => {
    let cancelled = false
    let pendingBitmap: ImageBitmap | null = null
    let objectUrl: string | null = null

    if (imageData) {
      const loadBitmap = async () => {
        try {
          const byteOffset = imageData.byteOffset ?? 0
          const byteLength = imageData.byteLength ?? imageData.buffer.byteLength
          const view = new Uint8Array(imageData.buffer, byteOffset, byteLength)
          const blob = new Blob([view], { type: 'image/png' })
          if (typeof createImageBitmap === 'function') {
            const bitmap = await createImageBitmap(blob)
            if (cancelled) {
              bitmap.close()
              return
            }
            pendingBitmap = bitmap
            assignImage(bitmap, bitmap.width, bitmap.height)
            pendingBitmap = null
          } else {
            objectUrl = URL.createObjectURL(blob)
            const img = new Image()
            img.onload = () => {
              if (cancelled) {
                URL.revokeObjectURL(objectUrl as string)
                objectUrl = null
                return
              }
              assignImage(img, img.naturalWidth, img.naturalHeight)
              URL.revokeObjectURL(objectUrl as string)
              objectUrl = null
            }
            img.onerror = () => {
              if (!cancelled) {
                assignImage(null, 0, 0)
              }
              if (objectUrl) {
                URL.revokeObjectURL(objectUrl)
                objectUrl = null
              }
            }
            img.src = objectUrl
          }
        } catch (error) {
          console.error('Screenshots createImageBitmap failed', error)
          if (!cancelled) {
            assignImage(null, 0, 0)
          }
        }
      }

      loadBitmap()

      return () => {
        cancelled = true
        if (pendingBitmap) {
          pendingBitmap.close()
          pendingBitmap = null
        }
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl)
          objectUrl = null
        }
      }
    }

    if (url) {
      const img = new Image()
      img.onload = () => {
        if (cancelled) {
          return
        }
        assignImage(img, img.naturalWidth, img.naturalHeight)
      }
      img.onerror = () => {
        if (!cancelled) {
          assignImage(null, 0, 0)
        }
      }
      img.src = url

      return () => {
        cancelled = true
      }
    }

    assignImage(null, 0, 0)

    return () => {
      cancelled = true
    }
  }, [imageData, url])

  useEffect(() => {
    return () => {
      releaseBitmap()
    }
  }, [])

  const onDoubleClick = useCallback(
    async (e: MouseEvent) => {
      if (e.button !== 0 || !image) {
        return
      }
      if (bounds && canvasContextRef.current) {
        composeImage({
          image,
          imageWidth,
          imageHeight,
          width,
          height,
          history,
          bounds
        }).then(blob => {
          call('onOk', blob, bounds)
          reset()
        })
      } else {
        const targetBounds = {
          x: 0,
          y: 0,
          width,
          height
        }
        composeImage({
          image,
          imageWidth,
          imageHeight,
          width,
          height,
          history,
          bounds: targetBounds
        }).then(blob => {
          call('onOk', blob, targetBounds)
          reset()
        })
      }
    },
    [image, imageWidth, imageHeight, history, bounds, width, height, call]
  )

  const onContextMenu = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 2) {
        return
      }
      e.preventDefault()
      call('onCancel')
      reset()
    },
    [call]
  )

  // 输入数据变化时重置截图区域
  useLayoutEffect(() => {
    reset()
  }, [url, imageData])

  return (
    <ScreenshotsContext.Provider value={{ store, dispatcher }}>
      <div
        className={classNames.join(' ')}
        style={{ width, height }}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      >
        <ScreenshotsBackground />
        <ScreenshotsCanvas ref={canvasContextRef} />
        <ScreenshotsOperations />
      </div>
    </ScreenshotsContext.Provider>
  )
}
