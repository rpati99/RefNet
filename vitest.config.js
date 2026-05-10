import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.js'],
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      react: resolve('./node_modules/react'),
      'react-dom': resolve('./node_modules/react-dom'),
      'react-router-dom': resolve('./node_modules/react-router-dom'),
      '@testing-library/react': resolve('./node_modules/@testing-library/react'),
    },
  },
});