import { Accessor, JSX, createContext, createSignal, onCleanup, useContext } from 'solid-js'
import { ConnectedPeer, SBClientOptions, Switchboard, TrackerOptions } from 'switchboard.js'
import { enableLogging } from 'switchboard.js'

enableLogging(true)

export type RawPeerData = string | ArrayBuffer | Blob | ArrayBufferView

interface NetworkContextType {
  broadcast: (data: RawPeerData) => void
  connection: Accessor<Switchboard | null>
  connect: () => Promise<void>
  disconnect: () => void
  currentSwarm: Accessor<string | undefined>
  setCurrentSwarm: (swarm: string) => void
  addDataHandler: (name: string, handler: (peerId: string, data: RawPeerData) => void) => void
  getPeerStream: (peerId: string) => MediaStream | undefined
  disconnected: Accessor<Set<string>>
  speaker: Accessor<string | undefined>
  setSpeaker: (peerId: string) => void
}

const customPeerOpts = {
  trickleICE: false,
  trickleTimeout: 15000,
  rtcPeerOpts: {
    iceCandidatePoolSize: 10,
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  }
}

export const discoveryTracker = async () => {
  // Проверяем, запущено ли приложение в Tauri
  const isTauri = window && 'window.__TAURI__' in window

  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const serverUrl = await invoke('find_local_server')
      console.log('Найден локальный сервер:', serverUrl)
      return { uri: serverUrl, isNativeServer: true } as TrackerOptions
    } catch {
      console.log('Локальный сервер не найден, запускаем свой')
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('start_peer_server')
      return { uri: 'ws://localhost:8080', isNativeServer: true } as TrackerOptions
    }
  } else {
    // Для браузера пробуем сначала Vercel трекер
    try {
      const uri = `https://${window.location.host}`
      const vercelTracker = {
        uri: `${uri}/api/tracker`,
        isRequired: false,
        customPeerOpts,
        connectTimeoutMs: 15000,
        maxReconnectAttempts: 3
      } as TrackerOptions

      // Проверяем доступность Vercel трекера
      const response = await fetch(`${uri}/api/tracker`)
      console.log('Vercel трекер ответ:', response)
      if (response.ok) {
        console.log('Vercel трекер доступен')
        return vercelTracker
      }
    } catch (e) {
      console.warn('Vercel трекер недоступен:', e)
    }

    // Если Vercel трекер недоступен, используем дефолтные
    console.log('Используем резервные трекеры')
    return (await Switchboard.defaultTrackers())[1] as TrackerOptions
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

  // Добавим список проверенных трекеров
  const RELIABLE_TRACKERS = [
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.btorrent.xyz',
    `https://${window.location.host}/api/tracker`
  ]

  const connect = async () => {
    console.log('NetworkProvider: Starting connection process')
    try {
      // Получаем все трекеры
      const defaultTrackers = await Switchboard.defaultTrackers()
      const extraTrackers = await Switchboard.getExtraTrackers()
      const vercelTracker = {
        uri: 'wss://your-vercel-app.vercel.app', // Замените на ваш домен
        isRequired: false,
        customPeerOpts,
        connectTimeoutMs: 15000,
        maxReconnectAttempts: 3
      }

      // Фильтруем только надежные трекеры и добавляем Vercel первым
      const trackers: TrackerOptions[] = [vercelTracker, ...defaultTrackers, ...extraTrackers]
        .filter((t) => RELIABLE_TRACKERS.includes(t.uri))
        .map((t) => ({
          ...t,
          customPeerOpts,
          connectTimeoutMs: 15000,
          maxReconnectAttempts: 3
        }))

      console.log('NetworkProvider: Using trackers:', trackers)

      const sb = new Switchboard('aho-network', {
        trackers,
        clientTimeout: 30000,
        clientMaxRetries: 3,
        clientBlacklistDuration: 30000,
        skipExtraTrackers: true,
        wsOpts: {
          handshakeTimeout: 30000,
          maxPayload: 65536
        }
      } as SBClientOptions)

      // Добавляем обработку переподключения при потере трекера
      sb.on('warn', (err) => {
        if (err.message.includes('tracker disconnected')) {
          console.warn('NetworkProvider: Tracker disconnected, attempting to reconnect...')
          // Пробуем переподключиться через 5 секунд
          setTimeout(() => {
            if (switchboard() === sb) {
              const swarmName = currentSwarm() || 'welcome'
              sb.swarm(swarmName).catch(console.error)
              location.hash = `#${swarmName}`
            }
          }, 5000)
        }
      })

      // Мониторим состояние каждого трекера
      sb.on('tracker-connect', (tracker) => {
        console.log('NetworkProvider: Tracker connected:', tracker.uri)
      })

      sb.on('connected', (openTrackers) => {
        console.log('NetworkProvider: Connected trackers:', openTrackers.length)
        openTrackers.forEach((t) => console.log('- Connected tracker:', t))
      })

      sb.on('kill', (err) => {
        console.error('NetworkProvider: Connection killed:', err)
        setSwitchboard(null)
      })

      sb.on('peer-seen', (peerId) => {
        console.log('NetworkProvider: Peer discovered:', peerId)
        // Проверяем, не наш ли это ID
        if (peerId === sb.peerID) {
          console.log('NetworkProvider: Skipping self peer')
          return
        }
      })

      sb.on('peer-error', (err) => {
        console.error('NetworkProvider: Peer connection error:', err)
      })

      sb.on('peer-blacklisted', (peer) => {
        console.warn('NetworkProvider: Peer blacklisted:', peer.id)
      })

      sb.on('peer', (peer: ConnectedPeer) => {
        console.log('NetworkProvider: New peer discovered:', peer)

        // Инициируем подключение
        if (!peer.isConnected) {
          console.log(`NetworkProvider: Initiating connection to peer ${peer.id}`)
        }

        peer.on('connect', () => {
          console.log(`NetworkProvider: Peer ${peer.id} connected, state:`, {
            connected: peer.isConnected,
            readyState: peer.isReady
          })

          // Ждем готовности канала данных
          if (peer.isReady) onPeerReady(peer, sb)
        })

        // Улучшаем обработку данных
        peer.on('data', (data: RawPeerData) => {
          console.log(`NetworkProvider: Raw data from ${peer.id}:`, data)

          // Для текстовых данных
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data)
              console.log('NetworkProvider: Parsed data:', parsed)
              handleRawPeerData(peer.id, data)
            } catch (_e) {
              console.log('NetworkProvider: Raw text data:', data)
              handleRawPeerData(peer.id, data)
            }
          }
          // Для бинарных данных
          else if (data instanceof ArrayBuffer || data instanceof Blob) {
            console.log('NetworkProvider: Binary data received')
            handleRawPeerData(peer.id, data)
          }
        })

        // Добавляем обработку ошибок соединения
        peer.on('error', (err) => {
          console.error(`NetworkProvider: Peer ${peer.id} error:`, err)
        })

        // Улучшаем обработку закрытия соединения
        peer.on('close', () => {
          console.log(`NetworkProvider: Peer ${peer.id} disconnected`)
          setDisconnected((prev) => {
            const newSet = new Set(prev)
            newSet.add(peer.id)
            return newSet
          })

          // Очищаем стрим
          setStreams((prev) => {
            const newStreams = { ...prev }
            delete newStreams[peer.id]
            return newStreams
          })
        })
      })
      const swarmName = window.location.hash.split('#')[1] || 'welcome'
      console.log('NetworkProvider: Attempting to join swarm:', swarmName)

      try {
        await sb.swarm(swarmName)
        console.log('NetworkProvider: Successfully joined swarm')
        setCurrentSwarm(swarmName)
        location.hash = `#${swarmName}`
        setSwitchboard(sb)
      } catch (swarmError) {
        console.error('NetworkProvider: Failed to join swarm:', swarmError)
        throw swarmError
      }

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
    const sb = switchboard()
    if (!sb) {
      console.warn('Network: No switchboard connection')
      return
    }

    const peers = sb.connectedPeers
    if (peers.length === 0) {
      console.warn('Network: No connected peers')
      return
    }

    console.log(
      'Network: Connected peers:',
      peers.map((p) => ({
        id: p.id,
        connected: p.isConnected,
        readyState: p.isReady
      }))
    )

    // Фильтруем только готовые к отправке пиры
    const readyPeers = peers.filter((p) => p.isConnected && p.isReady)

    if (readyPeers.length === 0) {
      console.warn('Network: No ready peers')
      return
    }

    readyPeers.forEach((peer) => {
      try {
        console.log(`Network: Sending to peer ${peer.id}`)
        peer.send(data)
      } catch (err) {
        console.error(`Network: Failed to send to peer ${peer.id}:`, err)
      }
    })
  }
  const getPeerStream = (peerId: string) => {
    return streams()[peerId]
  }
  // Выносим логику инициализации пира в отдельную функцию
  const onPeerReady = (peer: ConnectedPeer, sb: Switchboard) => {
    console.log(`NetworkProvider: Peer ${peer.id} ready for data`)

    // Удаляем из отключенных
    setDisconnected((prev) => {
      const newSet = new Set(prev)
      newSet.delete(peer.id)
      return newSet
    })

    // Отправляем приветствие
    try {
      const hello = {
        type: 'hello',
        from: sb.peerID,
        timestamp: Date.now()
      }
      console.log(`NetworkProvider: Sending hello to ${peer.id}:`, hello)
      peer.send(JSON.stringify(hello))
    } catch (e) {
      console.error('Failed to send hello:', e)
    }
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
