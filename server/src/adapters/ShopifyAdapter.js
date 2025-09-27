import { DataSourceAdapter } from './DataSourceAdapter.js'

export class ShopifyAdapter extends DataSourceAdapter {
  constructor() {
    super({ id: 'shopify', name: 'Shopify', description: 'Orders, customers, and products', icon: '🛍️' })
  }
  async connect(payload, _state) {
    // mock OAuth code exchange
    const shop = payload?.shop || 'demo.myshopify.com'
    return { connected: true, connectedAt: new Date().toISOString(), shop, token: 'mock_shopify_token' }
  }
  async fetchSnapshot(_state) {
    return {
      signals: {
        last_30d_orders: 124,
        average_order_value: 57.3,
        repeat_purchase_rate: 0.22
      }
    }
  }
}
