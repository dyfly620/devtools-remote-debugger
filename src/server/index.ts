import path from 'path';
import Koa from 'koa';
import KoaRouter from '@koa/router';
import cors from '@koa/cors';
import koaCompress from 'koa-compress';
import send from 'koa-send';
import imageToBase64 from 'image-to-base64';
import dotenv from 'dotenv';
import zlib from 'zlib';
import http from 'http';
import notFound from './middleware/404';
import SocketServer from './socketServer';

dotenv.config({
  path: path.resolve(process.cwd(), process.env.NODE_ENV === 'development' ? '.env.dev' : '.env'),
});

const prefix = '/remote/debug';

const compress = koaCompress({
  threshold: 2048,
  filter(contentType: string): boolean {
    return ['application/javascript', 'application/json', 'text/css'].includes(contentType);
  },
  gzip: {
    flush: zlib.constants.Z_SYNC_FLUSH,
  },
  deflate: {
    flush: zlib.constants.Z_SYNC_FLUSH,
  },
  br: false,
});

interface ClientItem {
  ws: unknown;
  [key: string]: unknown;
}

async function start({ port, host }: { port?: string; host?: string } = {}): Promise<void> {
  const app = new Koa();
  const wss = new SocketServer();
  const router = getRouter(wss.clients as unknown as Record<string, ClientItem>);

  app.use(cors())
    .use(notFound)
    .use(router)
    .use(compress);

  const server = app.listen(Number(port), host);
  wss.initSocketServer(server as unknown as http.Server);

  console.log(`serve start at:  http://localhost:${port}\n\n`);
}

function getRouter(clients: Record<string, ClientItem>) {
  const router = new KoaRouter({ prefix });

  router.get('/index.html', async (ctx) => {
    await send(ctx, getFilePath(ctx.path), {
      root: path.resolve(__dirname, '../../dist/page'),
    });
  });

  router.get('/dist/(.*)', async (ctx) => {
    await send(ctx, getFilePath(ctx.path));
  });

  router.get('/front_end/(.*)', async (ctx) => {
    await send(ctx, getFilePath(ctx.path).substring(10), {
      root: path.resolve(__dirname, '../../devtools-frontend'),
      maxage: 30 * 24 * 60 * 60 * 1000,
    });
  });

  router.get('/json', async (ctx) => {
    const targets = Object.values(clients).map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ws, ...data } = item;
      return data;
    })
      .sort((a, b) => Number(b.time) - Number(a.time));

    ctx.body = { targets };
  });

  router.get('/image_base64', async (ctx) => {
    const { url } = ctx.query;
    try {
      const base64 = await imageToBase64(url as string);
      ctx.body = { base64 };
    } catch {
      ctx.body = { base64: '' };
    }
  });

  // Routing for the example page
  router.get('/example/(.*)', async (ctx) => {
    await send(ctx, getFilePath(ctx.path));
  });

  return router.routes();
}

function getFilePath(pathStr: string): string {
  return pathStr.replace(`${prefix}/`, '');
}

start({
  port: process.env.DEBUG_PORT,
});
