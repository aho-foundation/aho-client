import { For, createSignal, onMount } from 'solid-js'
import { useContacts } from '~/context/contacts'
import { useNetwork } from '~/context/network'

import styles from '~/styles/ChatLog.module.css'

type Message = {
  from: string
  message: string
  ts: number
}

export const ChatLog = () => {
  const [messages, setMessages] = createSignal<Message[]>([])
  const { addDataHandler, connection } = useNetwork()
  const { getUsername } = useContacts()
  const addMessage = (from: string, body: string) => {
    setMessages((prev) => [
      ...prev,
      {
        from,
        message: body,
        ts: Date.now()
      }
    ])
  }
  onMount(() => {
    addDataHandler('chatlog', (peerId: string, data) => {
      const username = peerId === connection()?.peerID ? 'me' : getUsername(peerId)
      addMessage(username, data as string)
    })
  })

  return (
    <ul class={styles.chatLog}>
      <For each={messages()}>
        {(message) => (
          <li>
            {getUsername(message.from)}: {message.message}
          </li>
        )}
      </For>
    </ul>
  )
}
