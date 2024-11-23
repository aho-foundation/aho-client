import Discovery from 'torrent-discovery'
// biome-ignore lint/correctness/noNodejsModules: <explanation>
import crypto from 'node:crypto'

export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
}

export function createLogger(namespace) {
  return {
    error: (...args) => {
      console.error(`[${namespace}] ERROR:`, ...args)
    },

    warn: (...args) => {
      console.warn(`[${namespace}] WARN:`, ...args)
    },

    info: (...args) => {
      console.info(`[${namespace}] INFO:`, ...args)
    },

    debug: (...args) => {
      console.debug(`[${namespace}] DEBUG:`, ...args)
    }
  }
}

const logger = createLogger('tracker')

class TrackerManager {
  constructor() {
    this.discoveries = new Map() // infoHash -> Discovery
    this.stats = {
      peers: 0,
      torrents: new Set()
    }
  }

  initialize(infoHash) {
    if (this.discoveries.has(infoHash)) {
      return this.discoveries.get(infoHash)
    }

    const discovery = new Discovery({
      infoHash: infoHash,
      peerId: crypto.randomBytes(20), // Генерируем уникальный peerId
      port: 6881, // Стандартный порт для BitTorrent
      dht: true, // Включаем DHT для лучшего поиска пиров
      lsd: true, // Local Service Discovery тоже включен
      tracker: true, // Включаем только трекер
      userAgent: 'AHO-Client/1.0.0' // Наш идентификатор
    })

    this.setupEventHandlers(discovery, infoHash)
    this.discoveries.set(infoHash, discovery)
    logger.info(`Инициализирован трекер для ${infoHash}`)
    return discovery
  }

  setupEventHandlers(discovery, infoHash) {
    discovery.on('peer', (peer, source) => {
      this.stats.peers++
      this.stats.torrents.add(infoHash)
      logger.info(`Новый пир ${peer} из источника ${source} для ${infoHash}`)
    })

    discovery.on('warning', (err) => {
      logger.warn(`Предупреждение для ${infoHash}:`, err)
    })

    discovery.on('error', (err) => {
      logger.error(`Ошибка для ${infoHash}:`, err)
    })
  }

  getStats() {
    return {
      peers: this.stats.peers,
      torrents: this.stats.torrents.size,
      uptime: process.uptime(),
      activeDiscoveries: this.discoveries.size
    }
  }

  destroy(infoHash) {
    const discovery = this.discoveries.get(infoHash)
    if (discovery) {
      discovery.destroy()
      this.discoveries.delete(infoHash)
      logger.info(`Уничтожен трекер для ${infoHash}`)
    }
  }

  destroyAll() {
    for (const [infoHash, discovery] of this.discoveries) {
      discovery.destroy()
      logger.info(`Уничтожен трекер для ${infoHash}`)
    }
    this.discoveries.clear()
  }
}

const trackerManager = new TrackerManager()

export const handler = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({
      error: 'Метод не поддерживается',
      allowedMethods: ['GET']
    })
    return
  }

  try {
    const { url, headers } = req
    const parsedUrl = new URL(url, `https://${headers.host}`)
    const infoHash = parsedUrl.searchParams.get('info_hash')
    const path = parsedUrl.pathname.replace('/api/tracker', '')
    switch (path) {
      case '/':
        res.json({
          message: 'Hello, World!'
        })
        break
      case '/announce': {
        const discovery = trackerManager.initialize(infoHash)
        if (!infoHash) {
          res.status(400).json({ error: 'Отсутствует info_hash' })
          return
        }
        res.json({
          complete: discovery.peers.length,
          incomplete: 0,
          interval: 120,
          peers: discovery.peers
        })
        break
      }

      case '/stats':
        res.json(trackerManager.getStats())
        break

      default:
        res.status(404).json({ error: 'Путь не найден' })
    }
  } catch (error) {
    logger.error('Ошибка обработки запроса:', error)
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      message: error.message
    })
  }
}

// Очистка при выключении
process.on('SIGTERM', () => {
  trackerManager.destroyAll()
})

export default handler
