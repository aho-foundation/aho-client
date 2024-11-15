import { Component } from 'solid-js'
import { ChatLog } from '~/components/ChatLog'
import { OnlinePeers } from '~/components/OnlinePeers'
import { TalkingCircle } from '~/components/TalkingCircle'
import { ContactsProvider } from '~/context/contacts'
import { NetworkProvider } from '~/context/network'

const App: Component = () => {
  return (
    <NetworkProvider>
      <ContactsProvider>
        <>
          <TalkingCircle />
          <ChatLog />
          <OnlinePeers />
        </>
      </ContactsProvider>
    </NetworkProvider>
  )
}

export default App
