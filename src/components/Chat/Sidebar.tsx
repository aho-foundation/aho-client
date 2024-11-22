import { Component, createSignal } from 'solid-js'
import { TopControls } from '../TopControls.tsx'
import { BurgerButton } from './BurgerButton.tsx'
import { ChatLog } from './ChatLog.tsx'

import styles from '~/styles/Sidebar.module.css'

export const Sidebar: Component = () => {
  const [isOpen, setIsOpen] = createSignal(true)

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
