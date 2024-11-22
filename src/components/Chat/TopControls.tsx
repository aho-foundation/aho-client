import { Component, Show, createSignal } from 'solid-js'
import { useNetwork } from '~/context/network'

import styles from '~/styles/TopControls.module.css'

export const TopControls: Component = () => {
  const { connection, currentSwarm, connect } = useNetwork()
  const [isEditing, setIsEditing] = createSignal(false)
  const [swarmInput, setSwarmInput] = createSignal('')

  const handleSwarmChange = async (event: KeyboardEvent | FocusEvent) => {
    // Если это не Enter и не потеря фокуса - пропускаем
    if (event instanceof KeyboardEvent && event.key !== 'Enter') {
      return
    }

    const newSwarm = swarmInput().trim()
    if (!newSwarm) {
      console.log('TopControls: Empty swarm name, aborting')
      setIsEditing(false)
      return
    }

    console.log('TopControls: Attempting to join new swarm:', newSwarm)
    try {
      // Переподключаемся к новому свoрму
      await connection()?.swarm(newSwarm)
      console.log('TopControls: Successfully joined swarm:', newSwarm)
      setIsEditing(false)
    } catch (err) {
      console.error('TopControls: Failed to join swarm:', err)
    }
  }

  return (
    <div class={styles.topControls}>
      <div class={styles.leftControls}>
        <Show
          when={connection()?.peerID}
          fallback={
            <button class={styles.swarmButton} onClick={connect}>
              Подключиться
            </button>
          }
        >
          <Show
            when={!isEditing()}
            fallback={
              <input
                class={styles.swarmInput}
                value={swarmInput()}
                onInput={(e) => setSwarmInput(e.currentTarget.value)}
                onKeyDown={handleSwarmChange}
                onBlur={handleSwarmChange}
                placeholder="Введите имя свoрма"
                autofocus
              />
            }
          >
            <button
              class={styles.swarmButton}
              onClick={() => {
                setSwarmInput(currentSwarm() || '')
                setIsEditing(true)
              }}
            >
              #{currentSwarm()}
            </button>
          </Show>
        </Show>
      </div>
    </div>
  )
}
