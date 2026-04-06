import type { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { appConfig } from './config';

interface SSEClient {
  id: string;
  res: Response;
}

export class SSEBroker {
  private clients = new Map<string, SSEClient>();
  private keepAliveInterval: NodeJS.Timeout;

  constructor() {
    this.keepAliveInterval = setInterval(() => {
      this.broadcast('ping', { ts: Date.now() });
    }, appConfig.sseKeepAliveMs);
  }

  handleClient(_req: Request, res: Response) {
    const id = uuid();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('event: connected\n');
    res.write(`data: ${JSON.stringify({ id })}\n\n`);

    const client: SSEClient = { id, res };
    this.clients.set(id, client);

    reqOnClose(res, () => {
      this.clients.delete(id);
    });
  }

  broadcast(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      client.res.write(payload);
    }
  }

  close() {
    clearInterval(this.keepAliveInterval);
    for (const client of this.clients.values()) {
      client.res.end();
    }
    this.clients.clear();
  }
}

function reqOnClose(res: Response, fn: () => void) {
  // Node streams emit 'close' when client disconnects
  res.on('close', fn);
  res.on('finish', fn);
}
