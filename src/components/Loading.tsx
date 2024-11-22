import { createSignal, onMount } from 'solid-js'

import styles from '~/styles/Loading.module.css'

export const Loading = (props: { size?: number }) => {
  const [rotation, setRotation] = createSignal(0)

  onMount(() => {
    // Случайное начальное вращение
    setRotation(Math.random() * 360)
  })

  return (
    <div
      class={styles.loader}
      style={{
        width: `${props.size || 40}px`,
        height: `${props.size || 40}px`,
        transform: `rotate(${rotation()}deg)`
      }}
    >
      <div class={styles.stick} />
      <div class={styles.stick} />
      <div class={styles.stick} />
    </div>
  )
}
