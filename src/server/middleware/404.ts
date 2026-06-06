import { Context, Next } from 'koa';

const notFound = async (ctx: Context, next: Next): Promise<void> => {
  try {
    await next();
    const status = ctx.status || 404;
    if (status === 404) {
      ctx.type = 'html';
      ctx.body = 'Not Found';
    }
  } catch (err: any) {
    ctx.status = err.status || 500;
    ctx.type = 'html';
    ctx.body = 'error';
  }
};

export default notFound;
