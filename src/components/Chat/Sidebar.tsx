import { Component, createSignal } from 'solid-js'
import { Resizer } from '~/components/Resizer.tsx'
import { TopControls } from '../TopControls.tsx'
import { BurgerButton } from './BurgerButton.tsx'
import { ChatLog } from './ChatLog.tsx'

import styles from '~/styles/Sidebar.module.css'

export const Sidebar: Component = () => {
  const [isOpen, setIsOpen] = createSignal(true)
  const [width, setWidth] = createSignal(320)

  const handleResize = (newWidth: number) => {
    setWidth(newWidth)
  }

  return (
    <>
      <div class={styles.burgerWrapper}>
        <BurgerButton onClick={() => setIsOpen(!isOpen())} isOpen={isOpen()} />
      </div>

      <div
        class={`${styles.sidebar} ${isOpen() ? styles.open : ''}`}
        style={{ width: `${width()}px`, right: `-${width()}px` }}
      >
        <Resizer side="left" onResize={handleResize} minWidth={280} maxWidth={600}>
          <div class={styles.sidebarContent}>
            <TopControls />
            <ChatLog />
          </div>
        </Resizer>
      </div>
    </>
  )
}
