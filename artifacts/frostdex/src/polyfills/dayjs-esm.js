// ESM polyfill for dayjs/dayjs.min.js
// The orderly packages import dayjs via the UMD min bundle which uses require().
// We provide an ESM wrapper so the browser can load it without require().
// dayjs is pre-bundled by Vite from its main entry (index.js) when included.
export { default } from 'dayjs';
