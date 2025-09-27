export class DataSourceAdapter {
  constructor(meta) {
    this.id = meta.id; // stable id, e.g., 'shopify'
    this.name = meta.name; // display name
    this.description = meta.description || '';
    this.icon = meta.icon || '🔌';
    this.auth = meta.auth || { type: 'mock' };
  }

  // Return lightweight status derived from connection state
  getStatus(state) {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      icon: this.icon,
      connected: !!state?.connected,
      connectedAt: state?.connectedAt || null
    };
  }

  // Mock connect flow; override for real providers
  async connect(_payload, _state) {
    return { connected: true, connectedAt: new Date().toISOString(), token: `mock_${this.id}_token` };
  }

  async disconnect(_state) {
    return { connected: false };
  }

  // Provide a snapshot of useful signals to influence the AI orchestration
  async fetchSnapshot(_state) {
    return { signals: {} };
  }
}
