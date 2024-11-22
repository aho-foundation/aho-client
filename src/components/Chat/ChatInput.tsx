import { Component, createEffect, createSignal } from 'solid-js'
import { useMessages } from '~/context/messages'
import { useNetwork } from '~/context/network'

import styles from '~/styles/ChatInput.module.css'
import { PeerSelector } from './PeerSelector.tsx'

export const ChatInput: Component = () => {
  const [content, setContent] = createSignal('')
  const [isLongPress, setIsLongPress] = createSignal(false)
  const [pressTimer, setPressTimer] = createSignal<NodeJS.Timeout | number | null>(null)
  const [showPeerSelector, setShowPeerSelector] = createSignal(false)

  const [isSending, setIsSending] = createSignal(false)
  const [isError, setIsError] = createSignal(false)
  const [isSuccess, setIsSuccess] = createSignal(false)

  const { broadcast } = useNetwork()
  const { addMessage } = useMessages()

  const LONG_PRESS_DURATION = 500

  const resetState = (state: 'error' | 'success', duration = 2000) => {
    setTimeout(() => {
      if (state === 'error') setIsError(false)
      if (state === 'success') setIsSuccess(false)
    }, duration)
  }

  const handleSend = async () => {
    console.log('handleSend: Attempting to send message', { content: content() })
    const message = content().trim()
    if (!message) {
      console.log('handleSend: Empty message, aborting')
      return
    }

    try {
      if (showPeerSelector()) {
        console.log('handleSend: PeerSelector is open, skipping broadcast')
        return
      }

      setIsSending(true)
      console.log('handleSend: Broadcasting message', message)

      await broadcast(message)
      console.log('handleSend: Message broadcast successful')

      setIsSending(false)
      setIsSuccess(true)
      resetState('success')

      addMessage('me', message)
      console.log('handleSend: Message added to local chat')

      setContent('')
      console.log('handleSend: Content cleared')
    } catch (err) {
      console.error('handleSend: Error sending message:', err)
      setIsSending(false)
      setIsError(true)
      resetState('error')
    }
  }

  createEffect(() => {
    const { connection } = useNetwork()
    if (!connection()) {
      console.log('Network connection lost')
      setIsError(true)
      resetState('error')
    }
  })

  const handleInput = (event: InputEvent) => {
    const newValue = (event.target as HTMLTextAreaElement).value
    // console.log('handleInput: Updating content', newValue)
    setContent(newValue)
  }

  const handleMouseDown = () => {
    console.log('handleMouseDown: Starting long press timer')
    const timer = setTimeout(() => {
      console.log('handleMouseDown: Long press detected')
      setIsLongPress(true)
      setShowPeerSelector(true)
    }, LONG_PRESS_DURATION)
    setPressTimer(timer)
  }

  const handleMouseUp = () => {
    console.log('handleMouseUp:', { isLongPress: isLongPress() })
    if (pressTimer()) {
      clearTimeout(pressTimer() as NodeJS.Timeout)
      setPressTimer(null)
    }

    if (!isLongPress()) {
      handleSend()
    }
    setIsLongPress(false)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    // console.log('handleKeyDown:', { key: event.key, shiftKey: event.shiftKey })
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div class={styles.inputContainer}>
      <textarea
        class={styles.chatInput}
        placeholder={isError() ? 'Ошибка отправки...' : 'Введите сообщение...'}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        value={content()}
        rows={1}
        disabled={isSending()}
      />
      <button
        class={`${styles.sendButton} ${isLongPress() ? styles.longPress : ''} ${
          isSending() ? styles.sending : ''
        } ${isError() ? styles.error : ''} ${isSuccess() ? styles.success : ''}`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          console.log('handleMouseLeave: Clearing long press')
          if (pressTimer()) {
            clearTimeout(pressTimer() as NodeJS.Timeout)
            setPressTimer(null)
          }
          setIsLongPress(false)
        }}
        disabled={!content().trim() || isSending()}
        title={
          isError()
            ? 'Ошибка отправки'
            : isSending()
              ? 'Отправка...'
              : isSuccess()
                ? 'Отправлено!'
                : 'Отправить сообщение'
        }
      >
        <div class={styles.sendIcon} />
      </button>

      {showPeerSelector() && (
        <div class={styles.peerSelectorContainer}>
          <PeerSelector
            inputValue={content()}
            onClose={() => {
              console.log('PeerSelector: Closing')
              setShowPeerSelector(false)
            }}
            onSendComplete={() => {
              console.log('PeerSelector: Send complete, clearing input')
              setShowPeerSelector(false)
              setContent('')
            }}
          />
        </div>
      )}
    </div>
  )
}
