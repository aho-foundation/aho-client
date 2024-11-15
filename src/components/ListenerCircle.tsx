import { Component } from 'solid-js'
import { useContacts } from '~/context/contacts'

import styles from '~/styles/ListenerCircle.module.css'

interface ListenerCircleProps {
  peerId: string
  me?: boolean
  isSpeaking?: boolean
}

function peerIdColor(peerId: string): string {
  return `#${peerId.slice(0, 6)}`
}

export const ListenerCircle: Component<ListenerCircleProps> = (props) => {
  const { getUsername } = useContacts()

  return (
    <div class={styles.listenerCircle}>
      <div
        class={styles.listenerAvatar}
        style={{
          'background-color': peerIdColor(props.peerId),
          'border-color': props.me ? 'white' : peerIdColor(props.peerId),
          'border-width': props.isSpeaking ? '3px' : '1px'
        }}
      />
      <div class={styles.listenerName}>{getUsername(props.peerId)}</div>
    </div>
  )
}
