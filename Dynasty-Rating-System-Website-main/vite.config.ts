
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  base: '/tree/',
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      'figma:asset/9052ec8062b043d11876db1fa25ead193bb415c2.png': path.resolve(__dirname, './src/assets/9052ec8062b043d11876db1fa25ead193bb415c2.webp'),
      'figma:asset/7a0ac26a85cc417665b38254884871dd22d5b86b.png': path.resolve(__dirname, './src/assets/7a0ac26a85cc417665b38254884871dd22d5b86b.webp'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'build',
  },
  server: {
    port: 3000,
    open: true,
  },
});
