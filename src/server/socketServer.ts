import WebSocket, { Server as WebSocketServer } from 'ws';
import chalk from 'chalk';
import dayjs from 'dayjs';
import http from 'http';

const getTime = (): string => dayjs().format('YYYY-MM-DD HH:mm:ss');

interface ClientInfo {
  ws: WebSocket;
  id: string;
  pageUrl: string;
  ua: string;
  time: string;
  title: string;
  favicon: string;
}

interface DevtoolInfo {
  ws: WebSocket;
  id: string;
  clientId: string;
  client?: ClientInfo;
}

class SocketServer {
  clients: Record<string, ClientInfo> = {};
  devtools: Record<string, DevtoolInfo> = {};
  wss: WebSocketServer;

  constructor() {
    const wss = new WebSocketServer({ noServer: true });
    this.wss = wss;
  }

  initSocketServer(server: http.Server): void {
    const { wss } = this;
    server.on('upgrade', (request, socket, head) => {
      const urlParse = new URL(request.url!, 'http://0.0.0.0');
      const pathname = urlParse.pathname.replace('/remote/debug', '');
      const [, from, id] = pathname.split('/');

      if (from !== 'devtools' && from !== 'client') return;

      wss.handleUpgrade(request, socket, head, (ws) => {
        const { searchParams } = urlParse;

        // Create a connection for client sources
        if (from === 'client') {
          const pageUrl = searchParams.get('url') || '';
          this.createClientSocketConnect(ws, {
            id,
            pageUrl,
            ua: searchParams.get('ua') || '',
            time: searchParams.get('time') || '',
            title: searchParams.get('title') || '',
            favicon: searchParams.get('favicon') || '',
          });
        } else {
          // Create a connection sourced from devtools
          this.createDevtoolsSocketConnect(ws, {
            id,
            clientId: searchParams.get('clientId') || '',
          });
        }
      });
    });
  }

  // Create a client ws connection
  createClientSocketConnect(ws: WebSocket, connectInfo: Omit<ClientInfo, 'ws'>): void {
    const { id } = connectInfo;
    console.log(`${getTime()} ${chalk.bgCyan(chalk.black('client:'))} ${id} ${chalk.green('')}`);

    const sendToDevtools = (message: WebSocket.Data): void => {
      Object.values(this.devtools).forEach((devtool) => {
        if (devtool.clientId === id) {
          devtool.ws.send(message);
        }
      });
    };

    const closeToDevtools = (): void => {
      Object.values(this.devtools).forEach((devtool) => {
        if (devtool.clientId === id) {
          devtool.ws.close();
          delete this.devtools[devtool.id];
        }
      });
    };

    this.clients[id] = { ws, ...connectInfo };

    ws.on('message', sendToDevtools);
    ws.on('close', () => {
      console.log(`${getTime()} ${chalk.bgCyan(chalk.black('client:'))} ${id} ${chalk.red('disconnected')}`);
      delete this.clients[id];
      // After the client disconnects, clear the corresponding devtool connection
      closeToDevtools();
    });
  }

  // Create a devtools ws connection
  createDevtoolsSocketConnect(ws: WebSocket, connectInfo: Omit<DevtoolInfo, 'ws' | 'client'>): void {
    const { id, clientId } = connectInfo;
    console.log(`${getTime()} ${chalk.bgMagenta(chalk.black('devtools:'))} ${id} ${chalk.green('connected')}`);

    const client = this.clients[clientId];

    const devtool: DevtoolInfo = { ws, client, ...connectInfo };
    this.devtools[id] = devtool;

    ws.on('close', () => {
      console.log(`${getTime()} ${chalk.bgMagenta(chalk.black('devtools:'))} ${id} ${chalk.red('disconnected')}`);
      delete this.devtools[id];
    });

    if (!client) return;

    ws.on('message', (message: WebSocket.Data) => {
      client.ws.send(message);
    });
  }
}

export default SocketServer;
