import { For } from 'solid-js'
import { useContacts } from '~/context/contacts'
import { useNetwork } from '~/context/network'
import styles from '~/styles/OnlinePeers.module.css'

export const OnlinePeers = () => {
  const { connection } = useNetwork()
  const { getUsername } = useContacts()

  // Функция для генерации цвета на основе peerId (можно взять из ListenerCircle)
  const peerIdColor = (peerId: string): string => {
    return `#${peerId.slice(0, 6)}`
  }

  return (
    <div class={styles.peerCircles}>
      <For each={connection()?.connectedPeers ?? []}>
        {(peer) => (
          <div
            class={styles.peerCircle}
            style={{ 'background-color': peerIdColor(peer.id) }}
            data-peer-id={peer.id}
          >
            <span class={styles.peerInitial}>{getUsername(peer.id)[0].toUpperCase()}</span>
            <div class={styles.tooltip}>{getUsername(peer.id)}</div>
          </div>
        )}
      </For>
    </div>
  )
}

export default OnlinePeers
