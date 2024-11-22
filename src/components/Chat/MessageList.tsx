import { For, createEffect, on } from 'solid-js'
import { Message } from '~/components/Chat/ChatLog'
import { useContacts } from '~/context/contacts'
import styles from '~/styles/MessageList.module.css'

export const MessageList = (props: { messages: Message[] }) => {
  const { getUsername } = useContacts()
  let containerRef: HTMLUListElement | undefined

  // Автоскролл к последнему сообщению при добавлении новых
  createEffect(
    on(
      () => props.messages.length,
      () => {
        console.log('MessageList: New message detected, scrolling to bottom')
        if (containerRef) {
          containerRef.scrollTop = containerRef.scrollHeight
        }
      }
    )
  )

  return (
    <ul class={styles.chatLog} ref={containerRef}>
      <For each={props.messages || []}>
        {(message) => (
          <li class={`${styles.message} ${message.from === 'me' ? styles.self : ''}`}>
            <strong>{getUsername(message.from)}:</strong> {message.body}
          </li>
        )}
      </For>
    </ul>
  )
}
