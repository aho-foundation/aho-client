import { Component, For, Show, createSignal } from 'solid-js'
import { useContacts } from '~/context/contacts'
import { useNetwork } from '~/context/network'
import styles from '~/styles/PeerSelector.module.css'

interface PeerSelectorProps {
  inputValue: string
  onClose: () => void
  onSendComplete: () => void
  onPeerSelect?: (hasSelectedPeers: boolean) => void
}

export const PeerSelector: Component<PeerSelectorProps> = (props) => {
  const [selectedPeers, setSelectedPeers] = createSignal<string[]>([])
  const { connection } = useNetwork()
  const { getUsername } = useContacts()

  const togglePeerSelection = (peerId: string) => {
    const newSelected = selectedPeers().includes(peerId)
      ? selectedPeers().filter((id) => id !== peerId)
      : [...selectedPeers(), peerId]

    setSelectedPeers(newSelected)

    if (props.onPeerSelect) {
      props.onPeerSelect(newSelected.length > 0)
    }
  }

  const handleClose = () => {
    setSelectedPeers([])
    props.onClose()
  }

  return (
    <div class={styles.modalList} onClick={(e) => e.stopPropagation()}>
      <div class={styles.header}>
        <h3>Выберите получателей</h3>
        <button class={styles.closeButton} onClick={handleClose}>
          ×
        </button>
      </div>

      <div class={styles.selectedPeers}>
        {selectedPeers().length > 0 && (
          <div class={styles.selectedCount}>
            Выбрано:{' '}
            {selectedPeers()
              .map((id) => getUsername(id))
              .join(', ')}
          </div>
        )}
      </div>

      <div class={styles.peerList}>
        <For each={connection()?.connectedPeers || []}>
          {(peer) => (
            <div
              class={`${styles.peerItem} ${selectedPeers().includes(peer.id) ? styles.selected : ''}`}
              onClick={() => togglePeerSelection(peer.id)}
            >
              <div class={styles.peerInfo}>
                <div class={styles.peerAvatar}>{getUsername(peer.id)[0].toUpperCase()}</div>
                <span class={styles.peerName}>{getUsername(peer.id)}</span>
              </div>
              <div class={styles.checkbox}>
                <div class={styles.checkmark} />
              </div>
            </div>
          )}
        </For>
      </div>

      <Show when={(connection()?.connectedPeers || []).length === 0}>
        <div class={styles.errorTooltip}>
          Вы не подключены к сети. Попробуйте подключиться к другому трекеру
        </div>
      </Show>
    </div>
  )
}
