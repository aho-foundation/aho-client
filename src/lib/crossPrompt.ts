import modalStyles from '~/styles/Modal.module.css'

export async function crossPrompt(message: string, defaultValue = ''): Promise<string | null> {
  const isTauri = 'window.__TAURI__' in window

  if (isTauri) {
    try {
      return new Promise((resolve) => {
        const modal = document.createElement('div')
        const content = document.createElement('div')
        const text = document.createElement('p')
        const input = document.createElement('input')
        const btnContainer = document.createElement('div')
        const okBtn = document.createElement('button')
        const cancelBtn = document.createElement('button')

        Object.assign(modal.style, modalStyles.modal)
        Object.assign(content.style, modalStyles.content)
        Object.assign(input.style, modalStyles.input)
        Object.assign(btnContainer.style, modalStyles.buttons)

        text.textContent = message
        input.value = defaultValue
        okBtn.textContent = 'OK'
        cancelBtn.textContent = 'Отмена'

        okBtn.onclick = () => {
          resolve(input.value)
          document.body.removeChild(modal)
        }

        cancelBtn.onclick = () => {
          resolve(null)
          document.body.removeChild(modal)
        }

        btnContainer.append(cancelBtn, okBtn)
        content.append(text, input, btnContainer)
        modal.appendChild(content)
        document.body.appendChild(modal)

        input.focus()
      })
    } catch (e) {
      console.error('Ошибка диалога:', e)
      return null
    }
  } else {
    return window.prompt(message, defaultValue)
  }
}
