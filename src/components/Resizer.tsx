import { throttle } from '@solid-primitives/scheduled'
import { Component, JSXElement, createSignal, onCleanup } from 'solid-js'

import styles from '~/styles/Resizer.module.css'

type ResizerProps = {
  side: 'left' | 'right'
  onResize: (width: number) => void
  minWidth?: number
  maxWidth?: number
  children: JSXElement
}

export const Resizer: Component<ResizerProps> = (props) => {
  const [isDragging, setIsDragging] = createSignal(false)
  let startX = 0
  let startWidth = 0
  let resizerRef: HTMLDivElement | undefined
  let containerRef: HTMLDivElement | undefined

  // Оптимизированная функция обработки движения мыши
  const handleMouseMove = throttle((e: MouseEvent) => {
    if (!(isDragging() && containerRef)) return

    e.preventDefault()

    const deltaX = e.clientX - startX
    let newWidth = props.side === 'left' ? startWidth - deltaX : startWidth + deltaX

    // Применяем ограничения
    newWidth = Math.max(props.minWidth || 280, Math.min(props.maxWidth || 600, newWidth))

    props.onResize(newWidth)
  }, 16)

  const handleMouseDown = (e: MouseEvent) => {
    if (!containerRef) return

    e.preventDefault()
    startX = e.clientX
    startWidth = containerRef.offsetWidth

    setIsDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    // Добавляем обработчики только при начале перетаскивания
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    // Удаляем обработчики при окончании перетаскивания
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  // Очистка при размонтировании
  onCleanup(() => {
    if (isDragging()) {
      handleMouseUp()
    }
  })

  return (
    <div class={styles.resizerContainer} ref={containerRef}>
      {props.children}
      <div
        ref={resizerRef}
        class={`${styles.resizer} ${styles[props.side]} ${isDragging() ? styles.active : ''}`}
        onMouseDown={handleMouseDown}
        onTouchStart={(e) => {
          // Базовая поддержка тач-устройств
          const touch = e.touches[0]
          handleMouseDown({
            clientX: touch.clientX,
            preventDefault: () => e.preventDefault()
          } as MouseEvent)
        }}
      />
    </div>
  )
}
