import { Component, For, Show, createSignal, onMount } from 'solid-js'
import { ConnectedPeer } from 'switchboard.js'
import { CenterVideo } from '~/components/CenterVideo'
import { ListenerCircle } from '~/components/ListenerCircle'
import { RawPeerData, useNetwork } from '~/context/network'

import styles from '~/styles/TalkingCircle.module.css'

export type AhoMessage = { kind: string; reply?: string; body: string; order?: string[] }

export const TalkingCircle: Component = () => {
  const { connect, currentSwarm, connection, addDataHandler, broadcast, speaker, setSpeaker } =
    useNetwork()
  const [showContacts, setShowContacts] = createSignal(true)
  const [showChat, setShowChat] = createSignal(true)
  const [order, setOrder] = createSignal<string[]>([])

  onMount(() => {
    // data handler got 'aho!' from peer.id === speaker()
    addDataHandler('pass-the-talking-stick', (peerId: string, data: RawPeerData) => {
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data as string) as AhoMessage
          if (peerId === speaker() && parsed.kind === 'aho') {
            console.log('aho! from speaker, set order', peerId)
            const newOrder = parsed.order
            if (newOrder) {
              setOrder(newOrder)
              const speakerIndex = newOrder.indexOf(peerId)
              if (speakerIndex + 1 === newOrder.length) {
                setSpeaker(newOrder[0])
              } else {
                setSpeaker(newOrder[speakerIndex + 1])
              }
            }
          }
        } catch (e) {
          console.warn('cant parse data', e)
        }
      }
    })
    // data handler got 'aho' from non-speaker
    addDataHandler('aho', (peerId: string, data: RawPeerData) => {
      if (typeof data === 'string') {
        const parsed = JSON.parse(data as string) as AhoMessage
        if (peerId !== speaker() && parsed.kind === 'aho') {
          // TODO: update classname for animation
          console.log('aho! from non-speaker', peerId)
        }
      }
    })
    // data handler got 'welcome' from non-speaker, answering the connection announce
    addDataHandler('welcome', (peerId: string, data: RawPeerData) => {
      if (typeof data === 'string' && data === 'welcome') {
        console.log('welcome! from the one claiming to be a speaker', peerId)
        setSpeaker(peerId)
      }
    })
  })

  const handlePassTheTalkingStick = () => {
    broadcast(JSON.stringify({ kind: 'aho', order: order() }))
  }

  return (
    <div class={styles.container}>

      <div class={styles.controls}>
        <button onClick={connect}>{connection()?.peerID ? `#${currentSwarm()}` : 'Подключиться'}</button>
        <button onClick={() => setShowContacts((p) => !p)}>{showContacts() ? 'Скрыть' : 'Показать'} участников</button>
        <button onClick={() => setShowChat((p) => !p)}>{showChat() ? 'Скрыть' : 'Показать'} чат</button>
      </div>

      <div class={styles.mainContent}>
        {/* Центральный видео-спикер */}
        <Show when={speaker()} fallback={<div class={styles.placeholder}>Нет активного спикера</div>}>
          <CenterVideo peerId={speaker() || ''} />
          <Show when={speaker() === connection()?.peerID}>
            <button onClick={handlePassTheTalkingStick}>Передать слово</button>
          </Show>
        </Show>

        {/* Круг из участников */}
        <div class={styles.videoCircle}>
          <For each={connection()?.connectedPeers || []}>
            {(peer: ConnectedPeer) => (
              <ListenerCircle
                peerId={peer.id}
                me={connection()?.peerID === peer.id}
                isSpeaking={speaker() === peer.id}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
