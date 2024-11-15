import { For } from 'solid-js'
import { useContacts } from '~/context/contacts'
import { useNetwork } from '~/context/network'

import styles from '~/styles/OnlinePeers.module.css'

export const OnlinePeers = () => {
  const { connection } = useNetwork()
  const { getUsername } = useContacts()
  return (
    <ul class={styles.onlinePeers}>
      <For each={connection()?.connectedPeers ?? []}>
        {(peer) => (
          <li>{getUsername(peer.id)}</li>
        )}
      </For>
    </ul>
  )
}

export default OnlinePeers
