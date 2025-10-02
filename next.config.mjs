import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed manual react/react-dom aliasing; Next + npm hoisting already dedupe.
  // Custom alias was interfering with internal Next dynamic import of ReactDOM.preload.
};

export default nextConfig;
