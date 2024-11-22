import { Component, Show } from 'solid-js'
import { ChatInput } from '~/components/Chat/ChatInput'
import { MessageList } from '~/components/Chat/MessageList'
import { useMessages } from '~/context/messages'
import { useNetwork } from '~/context/network'

import styles from '~/styles/ChatLog.module.css'

export type Message = {
  from: string
  kind: string
  body: string
  ts?: number
}

export const ChatLog: Component = () => {
  console.log('ChatLog: Rendering')

  const { connection } = useNetwork()
  const { messages } = useMessages()

  return (
    <div class={styles.chatContainer}>
      <div class={styles.messageList}>
        <MessageList messages={messages() as unknown as Message[]} />
      </div>
      <Show when={connection()?.peerID}>
        <ChatInput />
      </Show>
    </div>
  )
}
