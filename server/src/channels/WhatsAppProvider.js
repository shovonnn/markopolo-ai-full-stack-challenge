import { ChannelProvider } from './ChannelProvider.js'

export class WhatsAppProvider extends ChannelProvider {
  constructor() {
    super({ id: 'whatsapp', name: 'WhatsApp', description: 'Template-based and session messaging', icon: '💬' })
  }
}
