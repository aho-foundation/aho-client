import { Accessor, JSX, createContext, createSignal, onCleanup, useContext } from 'solid-js'
import { ConnectedPeer, SBClientOptions, Switchboard, TrackerOptions } from 'switchboard.js'

export type RawPeerData = string | ArrayBuffer | Blob | ArrayBufferView

interface NetworkContextType {
  broadcast: (data: RawPeerData) => void
  connection: Accessor<Switchboard | null>
  connect: () => Promise<void>
  disconnect: () => void
  currentSwarm: Accessor<string | undefined>
  addDataHandler: (name: string, handler: (peerId: string, data: RawPeerData) => void) => void
  getPeerStream: (peerId: string) => MediaStream | undefined
  disconnected: Accessor<Set<string>>
  speaker: Accessor<string | undefined>
  setSpeaker: (peerId: string) => void
}

const workingDefaultTracker = {
  uri: 'wss://tracker.openwebtorrent.com',
  customPeerOpts: {
    trickleICE: false,
    trickleTimeout: 15000,
    rtcPeerOpts: {
      iceCandidatePoolSize: 10,
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    }
  }
} as TrackerOptions

export const discoveryTracker = async () => {
  // Проверяем, запущено ли приложение в Tauri
  const isTauri = window && 'window.__TAURI__' in window

  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const serverUrl = await invoke('find_local_server')
      console.log('Найден существующий сервер:', serverUrl)
      return serverUrl
    } catch {
      console.log('Сервер не найден, запускаем свой')
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('start_peer_server')
      return 'ws://localhost:8080'
    }
  } else {
    // Для браузера используем дефолтный трекер
    return workingDefaultTracker.uri
  }
}

const NetworkContext = createContext<NetworkContextType>()

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
    console.log('Получены сырые данные от пира:', peerId, data)
    if (typeof data === 'string') {
      let parsed = data
      try {
        parsed = JSON.parse(data)
        console.log('Разобранные данные:', parsed)
      } catch (e) {
        console.warn('Не удалось разобрать данные:', e)
      }
      Object.entries(dataHandlers()).forEach(([name, handler]) => {
        console.log('Вызов обработчика:', name)
        handler(peerId, data)
      })
    }
  }

  const connect = async () => {
    console.log('NetworkProvider: Starting connection process')
    try {
      console.log('NetworkProvider: Getting tracker URL')
      const trackerUrl = await discoveryTracker()
      console.log('NetworkProvider: Tracker URL received:', trackerUrl)

      const trackers = [workingDefaultTracker]

      if (trackerUrl !== workingDefaultTracker.uri) {
        console.log('NetworkProvider: Adding local tracker')
        trackers.push({
          uri: trackerUrl as string,
          customPeerOpts: workingDefaultTracker.customPeerOpts
        })
      }

      console.log('NetworkProvider: Creating Switchboard with trackers:', trackers)
      const sb = new Switchboard('aho-network', {
        trackers,
        clientTimeout: 30000,
        clientMaxRetries: 3,
        clientBlacklistDuration: 60000,
        wsOpts: {
          handshakeTimeout: 30000,
          maxPayload: 65536
        }
      } as SBClientOptions)

      console.log('NetworkProvider: Switchboard created, ID:', sb.peerID)

      sb.on('peer', (peer: ConnectedPeer) => {
        console.log('NetworkProvider: New peer discovered:', peer)
        peer.on('connect', () => {
          console.log(`NetworkProvider: Peer ${peer.id} connected`)
          if (switchboard()?.peerID === speaker()) {
            console.log(`NetworkProvider: Sending welcome to ${peer.id}`)
            peer.send('welcome')
          }
        })
        
        peer.on('data', (data: RawPeerData) => {
          console.log(`NetworkProvider: Received data from ${peer.id}:`, data)
          handleRawPeerData(peer.id, data)
        })
        peer.on('stream', (stream: MediaStream) => setStreams((prev) => ({ ...prev, [peer.id]: stream })))
        peer.on('close', () => {
          console.log(`Peer ${peer.id} disconnected`)
          setStreams((prev) => {
            const newStreams = { ...prev }
            delete newStreams[peer.id]
            return newStreams
          })
          setDisconnected((prev) => prev.add(peer.id))
        })

        peer.on('handshake', (message: string) => {
          console.log(`Peer ${peer.id} handshake:`, message)
        })

        peer.on('error', console.error)
      })
      const smarmName = window.location.hash.split('#')[1] || 'welcome'
      console.log('NetworkProvider: Attempting to join swarm "welcome"')
      await sb.swarm(smarmName)
      console.log('NetworkProvider: Successfully joined swarm')

      setCurrentSwarm(smarmName)
      setSwitchboard(sb)

      // Проверяем состояние после подключения
      console.log('NetworkProvider: Connection state:', {
        peerID: sb.peerID,
        connectedPeers: sb.connectedPeers,
        currentSwarm: currentSwarm()
      })
    } catch (err) {
      console.error('NetworkProvider: Connection failed with error:', err)
      setTimeout(connect, 5000)
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
