import { Component, createEffect, createSignal, on, Show } from 'solid-js'
import { useContacts } from '~/context/contacts'
import { useNetwork } from '~/context/network'
import { getMyStream } from '~/lib/getMyStream'

import styles from '~/styles/CenterVideo.module.css'

interface CenterVideoProps {
  peerId?: string
}

export const CenterVideo: Component<CenterVideoProps> = (props) => {
  const [videoRef, setVideoRef] = createSignal<HTMLVideoElement | null>(null)
  const { getPeerStream } = useNetwork()
  const { getUsername } = useContacts()
  
  // Добавим сигнал для отслеживания состояния стрима
  const [streamError, setStreamError] = createSignal<string>('')

  createEffect(
    on([videoRef, () => props.peerId], async ([video, peerId]) => {
      if (!video) return
      
      try {
        if (peerId) {
          const stream = getPeerStream(peerId)
          if (stream) {
            console.log('CenterVideo: Setting peer stream')
            video.srcObject = stream
            await video.play() // Явно запускаем воспроизведение
          } else {
            console.warn('CenterVideo: No stream for peer', peerId)
            setStreamError('Нет доступного потока для пира')
          }
        } else {
          console.log('CenterVideo: Getting local stream')
          const myStream = await getMyStream()
          video.srcObject = myStream
          await video.play() // Явно запускаем воспроизведение
        }
      } catch (err) {
        console.error('CenterVideo: Stream error:', err)
        setStreamError(`Ошибка потока: ${err}`)
      }
    })
  )

  return (
    <div class={styles.centerVideoContainer}>
      <div class={styles.videoWrapper}>
        <video 
          ref={setVideoRef} 
          autoplay 
          playsinline 
          muted={!props.peerId} 
          style={{ display: streamError() ? 'none' : 'block' }}
        />
      </div>
      <Show when={streamError()}>
        <div class={styles.streamError}>{streamError()}</div>
      </Show>
      <div class={styles.username}>
        {props.peerId ? getUsername(props.peerId) : 'You'}
      </div>
    </div>
  )
}
