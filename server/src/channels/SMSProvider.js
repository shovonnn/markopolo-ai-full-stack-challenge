import { ChannelProvider } from './ChannelProvider.js'

export class SMSProvider extends ChannelProvider {
  constructor() {
    super({ id: 'sms', name: 'SMS', description: 'Transactional/promotional text messages', icon: '📱' })
  }
}
