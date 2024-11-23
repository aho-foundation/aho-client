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

    // data handler got 'aho!' from peer.id === speaker()
    addDataHandler('pass-the-talking-stick', (peerId: string, data: RawPeerData) => {
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data) as AhoMessage
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
