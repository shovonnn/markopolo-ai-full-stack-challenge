import { ChannelProvider } from './ChannelProvider.js'

export class AdsProvider extends ChannelProvider {
  constructor() {
    super({ id: 'ads', name: 'Ads', description: 'Paid media and retargeting', icon: '📣' })
  }
}
