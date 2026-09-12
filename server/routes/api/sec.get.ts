import { defineEventHandler, getRequestURL } from 'h3';
import { GET } from '../../../app/api/sec/route';

export default defineEventHandler((event) =>
  GET(
      new Request(getRequestURL(event), {
        method: event.req.method,
        headers: event.req.headers,
      }),
  ),
);
