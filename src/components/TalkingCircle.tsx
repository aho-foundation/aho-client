import { Component, For, Show, createSignal, onMount } from 'solid-js'
import { ConnectedPeer } from 'switchboard.js'
import { CenterVideo } from '~/components/CenterVideo'
import { ListenerCircle } from '~/components/ListenerCircle'
import { Loading } from '~/components/Loading'
import { RawPeerData, useNetwork } from '~/context/network'
import { getMyStream } from '~/lib/getMyStream'

import styles from '~/styles/TalkingCircle.module.css'

export type AhoMessage = { kind: string; reply?: string; body: string; order?: string[] }

export const TalkingCircle: Component = () => {
  console.log('TalkingCircle: Rendering')

  const { connection, addDataHandler, broadcast, speaker, setSpeaker } = useNetwork()
  const [order, setOrder] = createSignal<string[]>([])
  const [mediaError, setMediaError] = createSignal<string>('')

  onMount(async () => {
    console.log('TalkingCircle: Mounted')

    // Запрашиваем разрешения на медиа при монтировании
    try {
      await getMyStream()
      console.log('TalkingCircle: Media permissions granted')
    } catch (err) {
      console.error('TalkingCircle: Failed to get media permissions:', err)
      setMediaError('Пожалуйста, разрешите доступ к камере и микрофону')
    }

    // Инициализируем order при монтировании
    const sb = connection()
    if (sb) {
      console.log('TalkingCircle: Initializing order with connected peers')
      const connectedPeers = sb.connectedPeers.map((peer) => peer.id)
      if (connectedPeers.length > 0) {
        setOrder(connectedPeers)
        console.log('TalkingCircle: Initial order set:', connectedPeers)
      }
    }

    // data handler got 'aho!' from peer.id === speaker()
    addDataHandler('pass-the-talking-stick', (peerId: string, data: RawPeerData) => {
      console.log('TalkingCircle: Received pass-the-talking-stick from', peerId, 'data:', data)
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data) as AhoMessage
          console.log('TalkingCircle: Parsed message:', parsed)
          if (peerId === speaker() && parsed.kind === 'aho') {
            console.log('TalkingCircle: Valid aho message from speaker', peerId)
            const newOrder = parsed.order
            if (newOrder) {
              console.log('TalkingCircle: Setting new order:', newOrder)
              setOrder(newOrder)
              const speakerIndex = newOrder.indexOf(peerId)
              const nextSpeaker =
                speakerIndex + 1 === newOrder.length ? newOrder[0] : newOrder[speakerIndex + 1]
              console.log('TalkingCircle: Setting next speaker:', nextSpeaker)
              setSpeaker(nextSpeaker)
            }
          } else {
            console.log('TalkingCircle: Invalid aho message - wrong speaker or kind', {
              currentSpeaker: speaker(),
              messagePeerId: peerId,
              messageKind: parsed.kind
            })
          }
        } catch (e) {
          console.warn('TalkingCircle: Failed to parse message:', e)
        }
      }
    })

    // data handler got 'aho' from non-speaker
    addDataHandler('aho', (peerId: string, data: RawPeerData) => {
      console.log('TalkingCircle: Received aho from', peerId, 'data:', data)
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data as string) as AhoMessage
          if (peerId !== speaker() && parsed.kind === 'aho') {
            console.log('TalkingCircle: Valid aho from non-speaker', peerId)
            // TODO: update classname for animation
          } else {
            console.log('TalkingCircle: Invalid aho - wrong conditions', {
              isSpeaker: peerId === speaker(),
              messageKind: parsed.kind
            })
          }
        } catch (e) {
          console.warn('TalkingCircle: Failed to parse aho message:', e)
        }
      }
    })

    // data handler got 'welcome' from speaker
    addDataHandler('welcome', (peerId: string, data: RawPeerData) => {
      console.log('TalkingCircle: Received welcome from', peerId, 'data:', data)
      if (typeof data === 'string' && data === 'welcome') {
        console.log('TalkingCircle: Setting speaker to', peerId)
        setSpeaker(peerId)
      }
    })
  })

  const handlePassTheTalkingStick = () => {
    const currentOrder = order()
    const sb = connection()
    if (!(sb && currentOrder.length > 0)) {
      console.warn('TalkingCircle: Cannot pass stick - no connection or empty order')
      return
    }

    // Обновляем порядок, добавляя новых пиров
    const updatedOrder = Array.from(new Set([...currentOrder, ...sb.connectedPeers.map((peer) => peer.id)]))
    console.log('TalkingCircle: Broadcasting aho with order:', updatedOrder)

    const message = JSON.stringify({ kind: 'aho', order: updatedOrder })
    broadcast(message)
    setOrder(updatedOrder)
  }

  return (
    <div class={styles.container}>
      <Show when={!mediaError()} fallback={<div class={styles.errorMessage}>{mediaError()}</div>}>
        <Show
          when={connection()?.peerID}
          fallback={
            <>
              {console.log('TalkingCircle: No connection, showing loading')}
              <Loading />
            </>
          }
        >
          <div class={styles.mainContent}>
            <Show
              when={speaker()}
              fallback={
                <>
                  {console.log('TalkingCircle: No active speaker')}
                  <Show when={connection()?.peerID} fallback={<Loading />}>
                    <CenterVideo />
                  </Show>
                </>
              }
            >
              <CenterVideo peerId={speaker() || ''} />
              <Show when={speaker() === connection()?.peerID}>
                <button onClick={handlePassTheTalkingStick}>Передать слово</button>
              </Show>
            </Show>

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
        </Show>
      </Show>
    </div>
  )
}
