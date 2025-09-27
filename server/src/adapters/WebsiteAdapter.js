import { DataSourceAdapter } from './DataSourceAdapter.js'

export class WebsiteAdapter extends DataSourceAdapter {
  constructor() {
    super({ id: 'website', name: 'Website', description: 'Behavioral and pixel events', icon: '🌐' })
  }
  async connect(payload, _state) {
    // mock pixel id validation
    const pixelId = payload?.pixelId || 'PX-TEST-1234'
    return { connected: true, connectedAt: new Date().toISOString(), pixelId }
  }
  async fetchSnapshot(_state) {
    return {
      signals: {
        cart_abandon_rate_7d: 0.62,
        active_users_14d: 5840,
        engagement_score: 73
      }
    }
  }
}
