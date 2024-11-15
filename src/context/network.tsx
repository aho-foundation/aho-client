import { Accessor, JSX, createContext, createSignal, onCleanup, useContext } from 'solid-js'
import { ConnectedPeer, SBClientOptions, Switchboard } from 'switchboard.js'

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

const NetworkContext = createContext<NetworkContextType>()

export const NetworkProvider = (props: { children: JSX.Element }) => {
  const [speaker, setSpeaker] = createSignal<string | undefined>()
  const [disconnected, setDisconnected] = createSignal<Set<string>>(new Set())
  const [streams, setStreams] = createSignal<Record<string, MediaStream>>({})
  const [switchboard, setSwitchboard] = createSignal<Switchboard | null>(null)
  const [currentSwarm, setCurrentSwarm] = createSignal<string | undefined>()
  const [dataHandlers, setDataHandlers] = createSignal<
    Record<string, (peerId: string, data: RawPeerData) => void>
  >({} as Record<string, (peerId: string, data: RawPeerData) => void>)

  const handleRawPeerData = (peerId: string, data: RawPeerData) => {
    // we accept parsable json strings
    if (typeof data === 'string') {
      let parsed = data
      try {
        parsed = JSON.parse(data)
      } catch (e) {
        console.warn('cant parse data', e)
      }
      Object.values(dataHandlers()).forEach((handler) => handler(peerId, parsed))
    }
  }

  const connect = async () => {
    try {
      // Создаем инстанс Switchboard
      const sb = new Switchboard('aho-network', {
        trackers: [
          {
            uri: 'wss://tracker.openwebtorrent.com',
            customPeerOpts: {
              trickleICE: false,
              trickleTimeout: 15000,
              rtcPeerOpts: {
                iceCandidatePoolSize: 10,
                iceServers: [
                  { urls: 'stun:stun.l.google.com:19302' }
                ]
              }
            }
          }
        ],
        clientTimeout: 30000,
        clientMaxRetries: 3,
        clientBlacklistDuration: 60000
      } as SBClientOptions)

      // Обработка подключения новых пиров
      sb.on('peer', (peer: ConnectedPeer) => {
        console.log('New peer connected:', peer)
        peer.on('connect', () => {
          console.log('Peer connected:', peer.id)
          if (switchboard()?.peerID === speaker()) {
            peer.send('welcome')
          }
        })
        peer.on('data', (data: RawPeerData) => handleRawPeerData(peer.id, data))
        peer.on('stream', (stream: MediaStream) => setStreams((prev) => ({ ...prev, [peer.id]: stream })))
        peer.on('close', () => {
          console.log('Peer disconnected:', peer.id)
          setStreams((prev) => {
            const newStreams = { ...prev }
            delete newStreams[peer.id]
            return newStreams
          })
          setDisconnected((prev) => prev.add(peer.id))
        })
      })
      sb.on('peer-error', console.error)
      sb.on('warn', console.warn)

      // Подключаемся к комнате
      const swarmName = window.location.hash || prompt('Enter a swarm name') || 'welcome'
      await sb.swarm(swarmName)
      setCurrentSwarm(swarmName)
      setSwitchboard(sb)
      console.debug(sb)
    } catch (err) {
      console.error('Failed to connect:', err)
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
    setDataHandlers((prev) => ({ ...prev, [name]: handler }))
  }

  const broadcast = (data: RawPeerData) => {
    Object.values(switchboard()?.connectedPeers || {}).forEach((p: ConnectedPeer) => p.send(data))
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
