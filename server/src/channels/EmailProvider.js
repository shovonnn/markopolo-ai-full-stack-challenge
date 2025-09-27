import { ChannelProvider } from './ChannelProvider.js'

export class EmailProvider extends ChannelProvider {
  constructor() {
    super({ id: 'email', name: 'Email', description: 'Send emails via your ESP', icon: '✉️' })
  }
}
