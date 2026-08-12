import { Brush, Check, Minus, Scan, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { ProcessedImage } from '../../integrations/image-processing'
import { Button, IconButton, SegmentedControl } from '../../ui'

type Tool = 'select' | 'brush'
type Operation = 'add' | 'subtract'

interface ManualCutoutEditorProps {
  initial: ProcessedImage
  original: ProcessedImage
  onCancel: () => void
  onConfirm: (image: ProcessedImage) => void
}

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('浏览器无法生成手动抠图结果。'))
    }, 'image/png')
  })

const loadBitmap = (blob: Blob) => createImageBitmap(blob)

export function ManualCutoutEditor({
  initial,
  original,
  onCancel,
  onConfirm,
}: ManualCutoutEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sourceRef = useRef<HTMLCanvasElement | null>(null)
  const maskRef = useRef<HTMLCanvasElement | null>(null)
  const gestureRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
  } | null>(null)
  const [tool, setTool] = useState<Tool>('brush')
  const [operation, setOperation] = useState<Operation>('subtract')
  const [brushSize, setBrushSize] = useState(44)
  const [zoom, setZoom] = useState(1)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const render = () => {
    const canvas = canvasRef.current
    const source = sourceRef.current
    const mask = maskRef.current
    if (!canvas || !source || !mask) return
    const sourceContext = source.getContext('2d', { willReadFrequently: true })
    const maskContext = mask.getContext('2d', { willReadFrequently: true })
    const context = canvas.getContext('2d')
    if (!sourceContext || !maskContext || !context) return
    const pixels = sourceContext.getImageData(0, 0, source.width, source.height)
    const maskPixels = maskContext.getImageData(0, 0, mask.width, mask.height)
    for (let index = 0; index < pixels.data.length; index += 4) {
      pixels.data[index + 3] = Math.round(
        ((pixels.data[index + 3] ?? 0) * (maskPixels.data[index + 3] ?? 0)) /
          255,
      )
    }
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.putImageData(pixels, 0, 0)
  }

  useEffect(() => {
    let cancelled = false
    void Promise.all([loadBitmap(original.blob), loadBitmap(initial.blob)])
      .then(([originalBitmap, initialBitmap]) => {
        if (cancelled) {
          originalBitmap.close()
          initialBitmap.close()
          return
        }
        const scale = Math.min(
          1,
          1600 / Math.max(originalBitmap.width, originalBitmap.height),
        )
        const width = Math.max(1, Math.round(originalBitmap.width * scale))
        const height = Math.max(1, Math.round(originalBitmap.height * scale))
        const source = document.createElement('canvas')
        const mask = document.createElement('canvas')
        source.width = mask.width = width
        source.height = mask.height = height
        source.getContext('2d')?.drawImage(originalBitmap, 0, 0, width, height)
        const initialCanvas = document.createElement('canvas')
        initialCanvas.width = width
        initialCanvas.height = height
        initialCanvas.getContext('2d')?.drawImage(initialBitmap, 0, 0, width, height)
        const initialPixels = initialCanvas
          .getContext('2d', { willReadFrequently: true })
          ?.getImageData(0, 0, width, height)
        const maskContext = mask.getContext('2d')
        if (!initialPixels || !maskContext) throw new Error('无法创建手动蒙版。')
        const maskPixels = maskContext.createImageData(width, height)
        for (let index = 0; index < maskPixels.data.length; index += 4) {
          maskPixels.data[index] = 255
          maskPixels.data[index + 1] = 255
          maskPixels.data[index + 2] = 255
          maskPixels.data[index + 3] = initialPixels.data[index + 3] ?? 0
        }
        maskContext.putImageData(maskPixels, 0, 0)
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = width
        canvas.height = height
        sourceRef.current = source
        maskRef.current = mask
        originalBitmap.close()
        initialBitmap.close()
        setReady(true)
        window.setTimeout(render, 0)
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '无法打开手动抠图。')
        }
      })
    return () => {
      cancelled = true
    }
  }, [initial.blob, original.blob])

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const paintLine = (fromX: number, fromY: number, toX: number, toY: number) => {
    const context = maskRef.current?.getContext('2d')
    if (!context) return
    context.save()
    context.globalCompositeOperation =
      operation === 'add' ? 'source-over' : 'destination-out'
    context.strokeStyle = '#ffffff'
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = brushSize
    context.beginPath()
    context.moveTo(fromX, fromY)
    context.lineTo(toX, toY)
    context.stroke()
    context.restore()
    render()
  }

  const finishGesture = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const point = pointFromEvent(event)
    if (tool === 'select') {
      const context = maskRef.current?.getContext('2d')
      if (context) {
        const x = Math.min(gesture.startX, point.x)
        const y = Math.min(gesture.startY, point.y)
        const width = Math.abs(point.x - gesture.startX)
        const height = Math.abs(point.y - gesture.startY)
        context.save()
        context.globalCompositeOperation =
          operation === 'add' ? 'source-over' : 'destination-out'
        context.fillStyle = '#ffffff'
        context.fillRect(x, y, width, height)
        context.restore()
        render()
      }
    }
    gestureRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const confirm = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setError(null)
    try {
      render()
      const blob = await canvasToBlob(canvas)
      onConfirm({
        blob,
        height: canvas.height,
        mimeType: 'image/png',
        width: canvas.width,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '手动抠图没有保存。')
    }
  }

  return (
    <section className="manual-cutout" aria-label="手动抠图">
      <header>
        <div>
          <p>手动修整</p>
          <strong>框选或涂抹要保留的区域</strong>
        </div>
        <IconButton label="关闭手动抠图" onClick={onCancel} variant="quiet">
          <X aria-hidden="true" size={18} />
        </IconButton>
      </header>
      <div className="manual-cutout-toolbar">
        <SegmentedControl
          ariaLabel="手动修整工具"
          onChange={setTool}
          options={[
            { icon: <Scan aria-hidden="true" size={16} />, label: '框选', value: 'select' },
            { icon: <Brush aria-hidden="true" size={16} />, label: '画笔', value: 'brush' },
          ]}
          value={tool}
        />
        <SegmentedControl
          ariaLabel="蒙版操作"
          onChange={setOperation}
          options={[
            { label: '添加', value: 'add' },
            { icon: <Minus aria-hidden="true" size={16} />, label: '移除', value: 'subtract' },
          ]}
          value={operation}
        />
        <label>
          画笔 {brushSize}px
          <input
            type="range"
            min="8"
            max="160"
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
          />
        </label>
        <IconButton label="缩小" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} variant="quiet">
          <ZoomOut aria-hidden="true" size={16} />
        </IconButton>
        <IconButton label="放大" onClick={() => setZoom(Math.min(3, zoom + 0.25))} variant="quiet">
          <ZoomIn aria-hidden="true" size={16} />
        </IconButton>
      </div>
      <div className="manual-cutout-frame">
        <canvas
          ref={canvasRef}
          style={{ transform: `scale(${zoom})` }}
          onPointerDown={(event) => {
            if (!ready) return
            const point = pointFromEvent(event)
            gestureRef.current = {
              pointerId: event.pointerId,
              startX: point.x,
              startY: point.y,
              lastX: point.x,
              lastY: point.y,
            }
            event.currentTarget.setPointerCapture(event.pointerId)
            if (tool === 'brush') paintLine(point.x, point.y, point.x, point.y)
          }}
          onPointerMove={(event) => {
            const gesture = gestureRef.current
            if (!gesture || gesture.pointerId !== event.pointerId || tool !== 'brush') return
            const point = pointFromEvent(event)
            paintLine(gesture.lastX, gesture.lastY, point.x, point.y)
            gesture.lastX = point.x
            gesture.lastY = point.y
          }}
          onPointerUp={finishGesture}
          onPointerCancel={(event) => {
            if (gestureRef.current?.pointerId === event.pointerId) gestureRef.current = null
          }}
        />
      </div>
      {error ? <p className="studio-error" role="alert">{error}</p> : null}
      <div className="manual-cutout-actions">
        <Button onClick={onCancel} variant="secondary">取消</Button>
        <Button
          disabled={!ready}
          icon={<Check aria-hidden="true" size={17} />}
          onClick={() => void confirm()}
          variant="primary"
        >确认修整</Button>
      </div>
    </section>
  )
}
