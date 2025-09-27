export class ChannelProvider {
  constructor(meta) {
    this.id = meta.id; // e.g., 'email'
    this.name = meta.name; // e.g., 'Email'
    this.description = meta.description || '';
    this.icon = meta.icon || '📡';
    this.auth = meta.auth || { type: 'mock' };
  }

  getStatus(state) {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      icon: this.icon,
      connected: !!state?.connected,
      connectedAt: state?.connectedAt || null,
    };
  }

  async connect(_payload, _state) {
    return { connected: true, connectedAt: new Date().toISOString(), token: `mock_${this.id}_token` };
  }

  async disconnect(_state) { return { connected: false }; }
}
