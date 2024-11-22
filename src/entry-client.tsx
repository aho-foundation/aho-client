import '~/styles/variables.css'
// @refresh reload
import { StartClient, mount } from '@solidjs/start/client'

console.log('Client entry: Starting application')

mount(() => {
  console.log('Client entry: Mounting root component')
  return <StartClient />
}, document.getElementById('app') || document.body)

export default {}
