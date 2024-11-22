import { Component, createSignal } from 'solid-js'
import styles from '~/styles/Sidebar.module.css'
import { BurgerButton } from './BurgerButton.tsx'
import { ChatLog } from './ChatLog.tsx'
import { TopControls } from './TopControls.tsx'

export const Sidebar: Component = () => {
  const [isOpen, setIsOpen] = createSignal(false)

  return (
    <>
      <div class={styles.burgerWrapper}>
        <BurgerButton onClick={() => setIsOpen(!isOpen())} isOpen={isOpen()} />
      </div>

      <div class={`${styles.sidebar} ${isOpen() ? styles.open : ''}`}>
        <TopControls />
        <ChatLog />
      </div>
    </>
  )
}
