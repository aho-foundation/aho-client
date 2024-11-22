import { Component, onMount } from 'solid-js'
import { Sidebar } from '~/components/Chat/Sidebar'
import { OnlinePeers } from '~/components/OnlinePeers'
import { TalkingCircle } from '~/components/TalkingCircle'
import { ContactsProvider } from '~/context/contacts'
import { MessagesProvider } from '~/context/messages'
import { NetworkProvider } from '~/context/network'
import { useNetwork } from '~/context/network'

import '~/styles/variables.css'

const AppContent: Component = () => {
  const { connect } = useNetwork()

  onMount(async () => {
    console.log('AppContent: Attempting auto-connect')
    try {
      await connect()
      console.log('AppContent: Auto-connect successful')
    } catch (err) {
      console.error('AppContent: Auto-connect failed:', err)
    }
  })

  return (
    <ContactsProvider>
      <OnlinePeers />
      <TalkingCircle />
      <MessagesProvider>
        <Sidebar />
      </MessagesProvider>
    </ContactsProvider>
  )
}

const App: Component = () => {
  console.log('App: Rendering root component')
  return (
    <NetworkProvider>
      <AppContent />
    </NetworkProvider>
  )
}

export default App
