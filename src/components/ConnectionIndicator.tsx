import { Component, createSignal, onCleanup, onMount } from 'solid-js'
import { useNetwork } from '~/context/network'
import styles from '~/styles/ConnectionIndicator.module.css'

export const ConnectionIndicator: Component = () => {
  const { connection } = useNetwork()
  const [status, setStatus] = createSignal<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [tooltip, setTooltip] = createSignal('')
  const [isAnnounce, setIsAnnounce] = createSignal(false)

  const updateStatus = () => {
    const sb = connection()
    if (!sb) {
      setStatus('disconnected')
      setTooltip('Отключено от сети')
      return
    }

    try {
      const connectedPeers = sb.connectedPeers.length
      if (connectedPeers > 0) {
        setStatus('connected')
        setTooltip(`Подключено к ${connectedPeers} пирам`)
      } else {
        setStatus('connecting')
        setTooltip('Поиск пиров...')
      }
    } catch (_e) {
      setStatus('disconnected')
      setTooltip('Ошибка подключения')
    }
  }

  onMount(() => {
    updateStatus()
    const interval = setInterval(updateStatus, 2000)

    const sb = connection()
    if (sb) {
      const announceHandler = () => {
        setIsAnnounce(true)
        setTimeout(() => setIsAnnounce(false), 500)
      }
      
      sb.on('tracker-connect', announceHandler)
    }

    onCleanup(() => {
      clearInterval(interval)
    })
  })

  return (
    <div class={styles.indicator} title={tooltip()}>
      <div 
        class={`
          ${styles.dot} 
          ${styles[status()]} 
          ${status() === 'connecting' ? styles.searching : ''} 
          ${isAnnounce() ? styles.announce : ''}
        `} 
      />
    </div>
  )
}
