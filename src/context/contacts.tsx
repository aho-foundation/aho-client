import { JSX, createContext, createSignal, useContext } from 'solid-js'
import { ConnectedPeer } from 'switchboard.js'
import { useNetwork } from '~/context/network'
import generateUsername from '~/namegen/username'

const ContactsContext = createContext<{ getUsername: (peerId: string) => string }>({
  getUsername: (_) => 'anonymous'
})

export const ContactsProvider = (props: { children: JSX.Element }) => {
  const { connection } = useNetwork()
  const [contacts, setContacts] = createSignal<Record<ConnectedPeer['id'], string>>({})
  const getUsername = (peerId: string) => {
    if (peerId in contacts()) {
      return contacts()[peerId]
    }
    if (connection()?.peerID === peerId) {
      return 'me'
    }
    const username = generateUsername()
    setContacts((prev) => ({ ...prev, [peerId]: username }))
    return username
  }

  return <ContactsContext.Provider value={{ getUsername }}>{props.children}</ContactsContext.Provider>
}

export const useContacts = () => {
  return useContext(ContactsContext)
}
