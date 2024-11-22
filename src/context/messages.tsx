import { JSX, createContext, createSignal, useContext } from 'solid-js'
import { Message } from '~/components/Chat/ChatLog'

interface MessagesContextValue {
  messages: () => Message[]
  addMessage: (from: string, body: string) => void
  selectedPeers: () => string[]
  setSelectedPeers: (peers: string[]) => void
}

const MessagesContext = createContext<MessagesContextValue>()

export const MessagesProvider = (props: { children: JSX.Element }) => {
  const [messages, setMessages] = createSignal<Message[]>([])
  const [selectedPeers, setSelectedPeers] = createSignal<string[]>([])

  const addMessage = (from: string, body: string) => {
    setMessages((prev) => [
      ...prev,
      {
        from,
        body,
        kind: 'text',
        ts: Date.now()
      }
    ])
  }

  return (
    <MessagesContext.Provider value={{ messages, addMessage, selectedPeers, setSelectedPeers }}>
      {props.children}
    </MessagesContext.Provider>
  )
}

export const useMessages = () => {
  const context = useContext(MessagesContext)
  if (!context) {
    throw new Error('useMessages must be used within MessagesProvider')
  }
  return context
}
