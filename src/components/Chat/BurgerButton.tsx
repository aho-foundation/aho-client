import { Component } from 'solid-js'
import styles from '~/styles/BurgerButton.module.css'

interface BurgerButtonProps {
  onClick: () => void
  isOpen: boolean
}

export const BurgerButton: Component<BurgerButtonProps> = (props) => {
  return (
    <button class={`${styles.burgerButton} ${props.isOpen ? styles.open : ''}`} onClick={props.onClick}>
      <span />
      <span />
      <span />
    </button>
  )
}
