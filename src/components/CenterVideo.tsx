import { Component, createEffect, createSignal, on } from 'solid-js'

import { useContacts } from '~/context/contacts'
import { useNetwork } from '~/context/network'

import styles from '~/styles/CenterVideo.module.css'

interface CenterVideoProps {
  peerId: string
}

export const CenterVideo: Component<CenterVideoProps> = (props) => {
  const [videoRef, setVideoRef] = createSignal<HTMLVideoElement | null>(null)
  const { getPeerStream } = useNetwork()
  const { getUsername } = useContacts()

  createEffect(
    on([videoRef, () => props.peerId], ([video, peerId]) => {
      if (video) {
        const stream = getPeerStream(peerId)
        if (stream) {
          video.srcObject = stream
        }
      }
    })
  )

  return (
    <div class={styles.centerVideoContainer}>
      <video ref={setVideoRef} autoplay playsinline />
      <div class={styles.username}>{getUsername(props.peerId)}</div>
    </div>
  )
}
