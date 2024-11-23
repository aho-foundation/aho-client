import { Accessor, JSX, Setter, createContext, createSignal, onCleanup, useContext } from 'solid-js'
import { ConnectedPeer, Switchboard, TrackerOptions } from 'switchboard.js'

export type RawPeerData = string | ArrayBuffer | Blob | ArrayBufferView

interface NetworkContextType {
  broadcast: (data: RawPeerData) => void
  connection: Accessor<Switchboard | null>
  connect: () => Promise<void>
  disconnect: () => void
  currentSwarm: Accessor<string | undefined>
  setCurrentSwarm: Setter<string | undefined>
  addDataHandler: (name: string, handler: (peerId: string, data: RawPeerData) => void) => void
  getPeerStream: (peerId: string) => MediaStream | undefined
  disconnected: Accessor<Set<string>>
  speaker: Accessor<string | undefined>
  setSpeaker: (peerId: string) => void
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  {
    urls: 'turn:numb.viagenie.ca',
    username: 'webrtc@live.com',
    credential: 'muazkh'
  },
  {
    urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
    username: 'webrtc',
    credential: 'webrtc'
  }
]

const customPeerOpts = {
  trickle: true,
  config: {
    iceServers: ICE_SERVERS,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  },
  offerOptions: {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  },
  connectTimeout: 30000,
  handshakeTimeout: 30000
} as TrackerOptions['customPeerOpts']

export const discoveryTracker = async (): Promise<string | undefined> => {
  // Проверяем, запущено ли приложение в Tauri
  const isTauri = window && 'window.__TAURI__' in window

  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const serverUrl = await invoke<string>('find_local_server')
      console.log('Найден существующий сервер:', serverUrl)
      return serverUrl
    } catch {
      console.log('Сервер не найден, запускаем свой')
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('start_peer_server')
      return 'ws://localhost:8080'
    }
  }
  return undefined
}

const NetworkContext = createContext<NetworkContextType>()

const checkWebRTCSupport = () => {
  if (typeof RTCPeerConnection === 'undefined') {
    console.error('WebRTC is not supported in this browser')
    return false
  }

  // Проверяем основные необходимые API
  const apis = ['RTCPeerConnection', 'RTCSessionDescription', 'RTCIceCandidate', 'MediaStream']

  const missing = apis.filter((api) => !(api in window))
  if (missing.length > 0) {
    console.error('Missing WebRTC APIs:', missing)
    return false
  }

  return true
}

const checkNetworkConnectivity = () => {
  if (!navigator.onLine) {
    console.error('No internet connection')
    return false
  }
  return true
}

const checkWebRTCBlocking = async () => {
  try {
    console.log('Checking WebRTC connectivity...')

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all'
    })

    // Отслеживаем состояние ICE подключения
    pc.oniceconnectionstatechange = () => {
      console.log('ICE Connection State:', pc.iceConnectionState)
    }

    // Отслеживаем сбор ICE кандидатов
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Found ICE candidate:', event.candidate.candidate)
      }
    }

    // Создаем data channel для теста
    const dc = pc.createDataChannel('test')

    dc.onopen = () => {
      console.log('Test data channel opened successfully')
    }

    dc.onerror = (error) => {
      console.error('Data channel error:', error)
    }

    // Создаем и устанавливаем локальное описание
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    // Ждем немного, чтобы увидеть, собираются ли ICE кандидаты
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (pc.localDescription) {
      // Проверяем наличие ICE кандидатов в SDP
      const hasIceCandidates = pc.localDescription.sdp.includes('a=candidate:')
      console.log('Has ICE candidates:', hasIceCandidates)

      if (!hasIceCandidates) {
        console.warn('No ICE candidates found - possible network restriction')
      }

      pc.close()
      return hasIceCandidates
    }

    console.error('Failed to create local description')
    return false
  } catch (err) {
    console.error('WebRTC check failed:', err)
    if (err instanceof Error) {
      // Анализируем конкретные ошибки
      if (err.message.includes('Permission denied') || err.message.includes('NotAllowedError')) {
        console.error('WebRTC blocked by browser permissions')
      } else if (err.message.includes('Failed to construct')) {
        console.error('WebRTC API not available or blocked')
      }
    }
    return false
  }
}

export const NetworkProvider = (props: { children: JSX.Element }) => {
  console.log('NetworkProvider: Initializing')
  const [speaker, setSpeaker] = createSignal<string | undefined>()
  const [disconnected, setDisconnected] = createSignal<Set<string>>(new Set())
  const [streams, setStreams] = createSignal<Record<string, MediaStream>>({})
  const [switchboard, setSwitchboard] = createSignal<Switchboard | null>(null)
  const [currentSwarm, setCurrentSwarm] = createSignal<string | undefined>()
  const [dataHandlers, setDataHandlers] = createSignal<
    Record<string, (peerId: string, data: RawPeerData) => void>
  >({} as Record<string, (peerId: string, data: RawPeerData) => void>)

  const handleRawPeerData = (peerId: string, data: RawPeerData) => {
    console.log('Получены данные от пира:', peerId, data)
    for (const handler of Object.values(dataHandlers())) {
      handler(peerId, data)
    }
  }

  const connect = async () => {
    console.log('NetworkProvider: Starting connection process')

    if (!checkWebRTCSupport()) {
      throw new Error('WebRTC is not supported in this browser')
    }

    if (!checkNetworkConnectivity()) {
      throw new Error('No internet connection')
    }

    if (!(await checkWebRTCBlocking())) {
      console.error('WebRTC connections are blocked')
      throw new Error(
        'WebRTC connections seem to be blocked. Check your browser settings, extensions, antivirus and firewall.'
      )
    }

    try {
      const trackers: TrackerOptions[] = [...(await Switchboard.defaultTrackers())].map((tracker) => ({
        ...tracker,
        customPeerOpts
      }))

      // Добавляем локальный трекер если есть
      const trackerUrl = await discoveryTracker()
      if (trackerUrl) {
        console.log('NetworkProvider: Adding local tracker', trackerUrl)
        trackers.push({
          uri: trackerUrl,
          isNative: true,
          customPeerOpts
        } as TrackerOptions)
      }

      console.log('NetworkProvider: Creating Switchboard with trackers:', trackers)
      const sb = new Switchboard('aho-network', {
        trackers,
        clientTimeout: 30000
      })

      console.log('NetworkProvider: Switchboard created, ID:', sb.peerID)

      // Подключаемся к рою
      const swarmName = window.location.hash.split('#')[1] || 'welcome'
      console.log('NetworkProvider: Attempting to join swarm:', swarmName)

      await sb.swarm(swarmName)
      console.log('NetworkProvider: Successfully joined swarm')
      setCurrentSwarm(swarmName)
      setSwitchboard(sb)

      // Обработка событий пиров
      sb.on('peer', (peer: ConnectedPeer) => {
        console.log('NetworkProvider: New peer discovered:', peer)

        peer.on('connect', () => {
          console.log('NetworkProvider: Peer connected:', peer.id)
          setDisconnected((prev) => {
            const next = new Set(prev)
            next.delete(peer.id)
            return next
          })

          // Отправляем приветствие новому пиру
          if (speaker() === sb.peerID) {
            console.log('NetworkProvider: We are speaker, sending welcome to:', peer.id)
            peer.send('welcome')
          }
        })

        // Обработка данных от пира
        peer.on('data', (data: RawPeerData) => {
          console.log('NetworkProvider: Received data from peer:', peer.id, data)
          try {
            handleRawPeerData(peer.id, data)
          } catch (err) {
            console.error('NetworkProvider: Error handling peer data:', err)
          }
        })
        // Обработка медиа-потоков
        peer.on('stream', (stream: MediaStream) => {
          console.log('NetworkProvider: Received stream from peer:', peer.id)
          setStreams((prev) => ({ ...prev, [peer.id]: stream }))
        })

        peer.on('close', () => {
          console.log('NetworkProvider: Peer disconnected:', peer.id)
          setStreams((prev) => {
            const next = { ...prev }
            delete next[peer.id]
            return next
          })
          setDisconnected((prev) => prev.add(peer.id))
        })

        peer.on('handshake', (message: string) => {
          console.log(`Peer ${peer.id} handshake:`, message)
        })

        peer.on('error', console.error)
      })
    } catch (err) {
      console.error('NetworkProvider: Connection failed:', err)
      throw err
    }
  }

  const disconnect = () => {
    const sb = switchboard()
    if (sb) {
      sb.kill(undefined, true) // Закрываем все peer соединения
      setSwitchboard(null)
    }
  }

  // Очистка при размонтировании компонента
  onCleanup(() => {
    disconnect()
  })

  const addDataHandler = (name: string, handler: (peerId: string, data: RawPeerData) => void) => {
    console.log('NetworkProvider: Adding data handler:', name)
    setDataHandlers((prev) => {
      const newHandlers = { ...prev, [name]: handler }
      console.log('NetworkProvider: Current handlers:', Object.keys(newHandlers))
      return newHandlers
    })
  }

  const broadcast = (data: RawPeerData) => {
    console.log('Network: Broadcasting message:', data)
    const peers = switchboard()?.connectedPeers
    if (peers) {
      const peerIds = Object.keys(peers)
      console.log('Network: Sending to peers:', peerIds)
      try {
        Object.values(peers).forEach((p: ConnectedPeer) => {
          console.log('Network: Sending to peer:', p.id)
          p.send(data)
        })
        console.log('Network: Broadcast complete')
      } catch (err) {
        console.error('Network: Broadcast failed:', err)
      }
    } else {
      console.warn('Network: No connected peers')
    }
  }
  const getPeerStream = (peerId: string) => {
    return streams()[peerId]
  }
  return (
    <NetworkContext.Provider
      value={{
        broadcast,
        connection: switchboard,
        currentSwarm,
        setCurrentSwarm,
        connect,
        disconnect,
        addDataHandler,
        getPeerStream,
        disconnected,
        speaker,
        setSpeaker
      }}
    >
      {props.children}
    </NetworkContext.Provider>
  )
}

export const useNetwork = () => {
  const context = useContext(NetworkContext)
  if (!context) {
    throw new Error('useNetwork должен использоваться внутри NetworkProvider')
  }
  return context
}
