import { Server } from 'bittorrent-tracker'

// Конфигурация трекера
const trackerOpts = {
  http: true, // Только HTTP для Vercel
  udp: false,
  ws: false,
  stats: false
}

// Обработчик HTTP запросов для Vercel
export default async function handler(req, res) {
  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Preflight запросы
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Только GET запросы
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Метод не поддерживается' })
    return
  }

  try {
    // Создаем новый инстанс трекера для каждого запроса
    const tracker = new Server(trackerOpts)

    // Обработка ошибок
    tracker.on('error', (err) => {
      console.error('Ошибка трекера:', err.message)
    })

    tracker.on('warning', (err) => {
      console.warn('Предупреждение трекера:', err.message)
    })

    // Логирование событий
    tracker.on('start', (addr) => {
      console.log('Новое подключение:', addr)
    })

    tracker.on('complete', (addr) => {
      console.log('Завершено подключение:', addr)
    })

    tracker.on('stop', (addr) => {
      console.log('Отключение:', addr)
    })

    // Парсим параметры запроса
    const { url, headers } = req
    const parsedUrl = new URL(url, `https://${headers.host}`)

    // Обрабатываем announce/scrape запросы
    if (parsedUrl.pathname === '/announce') {
      await new Promise((resolve) => {
        tracker.onHttpRequest(req, res, () => {
          resolve()
          tracker.destroy()
        })
      })
    } else if (parsedUrl.pathname === '/scrape') {
      await new Promise((resolve) => {
        tracker.onHttpRequest(req, res, () => {
          resolve()
          tracker.destroy()
        })
      })
    } else {
      res.status(404).json({ error: 'Не найдено' })
    }
  } catch (error) {
    console.error('Ошибка обработки запроса:', error)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
}
