import { Component, Show, createSignal } from 'solid-js'
import { useNetwork } from '~/context/network'

import styles from '~/styles/TopControls.module.css'

export const TopControls: Component = () => {
  const { connection, currentSwarm, connect, disconnect } = useNetwork()
  const [isEditing, setIsEditing] = createSignal(false)
  const [swarmInput, setSwarmInput] = createSignal('')
  const [isConnecting, setIsConnecting] = createSignal(false)

  const waitForConnection = async () => {
    const sb = connection()
    if (!sb) return false

    let attempts = 0
    const maxAttempts = 10

    return new Promise<boolean>((resolve) => {
      const checkConnection = () => {
        attempts++
        
        try {
          if (sb.peerID) {
            resolve(true)
            return
          }
        } catch (e) {
          console.log('Connection check failed:', e)
        }

        if (attempts >= maxAttempts) {
          resolve(false)
          return
        }

        setTimeout(checkConnection, 500)
      }

      checkConnection()
    })
  }

  const handleSwarmChange = async (event: KeyboardEvent | FocusEvent) => {
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
    setIsConnecting(true)
    
    try {
      // Отключаемся от текущего сворма
      await disconnect()
      console.log('TopControls: Disconnected from current swarm')
      
      // Ждем немного для очистки состояния
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Подключаемся и ждем установки соединения
      await connect()
      
      // Проверяем состояние соединения с повторными попытками
      const isConnected = await waitForConnection()
      
      if (!isConnected) {
        throw new Error('Failed to establish connection after multiple attempts')
      }

      // Дополнительная пауза перед присоединением к сворму
      await new Promise(resolve => setTimeout(resolve, 500))

      // Присоединяемся к новому сворму
      await connection()?.swarm(newSwarm)
      console.log('TopControls: Successfully joined swarm:', newSwarm)
      window.location.hash = `#${newSwarm}`
      setIsEditing(false)
    } catch (err) {
      console.error('TopControls: Failed to join swarm:', err)
    } finally {
      setIsConnecting(false)
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
