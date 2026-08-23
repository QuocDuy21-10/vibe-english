import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';

function devApiServerPlugin(): Plugin {
  return {
    name: 'dev-api-serverless-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (url === '/api/ai/word-details' || url.startsWith('/api/ai/word-details?')) {
          try {
            let body = '';
            for await (const chunk of req) {
              body += chunk;
            }
            let parsedBody = {};
            if (body) {
              try {
                parsedBody = JSON.parse(body);
              } catch {
                parsedBody = body;
              }
            }

            const fakeReq: any = {
              method: req.method,
              headers: req.headers,
              body: parsedBody,
              query: {},
              url: req.url
            };

            const fakeRes: any = {
              setHeader(name: string, value: any) {
                res.setHeader(name, value);
                return this;
              },
              status(code: number) {
                res.statusCode = code;
                return this;
              },
              json(data: any) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return this;
              }
            };

            const { default: handler } = await import('./api/ai/word-details.ts');
            await handler(fakeReq, fakeRes);
          } catch (err: any) {
            console.error('Dev API Error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
          }
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Set server-side environment variable for local dev
  if (env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }
  if (env.FIREBASE_PROJECT_ID) {
    process.env.FIREBASE_PROJECT_ID = env.FIREBASE_PROJECT_ID;
  }

  return {
    plugins: [react(), tailwindcss(), devApiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      port: 3000,
      host: '0.0.0.0'
    }
  };
});
