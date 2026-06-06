export default class BaseDomain {
  socket: any;

  constructor(options: { socket: any }) {
    this.socket = options.socket;
  }

  enable(): void {}

  send(data: Record<string, unknown>): void {
    this.socket.send(JSON.stringify(data));
  }
}
