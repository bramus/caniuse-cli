import { styleText } from 'node:util';
import { DEFAULT_ITEM_WIDTH } from '../constants.js';

/**
 * padCenter() returns fixed length string,
 * padding with padStr from both sides if necessary
 */
export const padCenter = function padCenter(str, length = DEFAULT_ITEM_WIDTH, padStr = ' ') {
  const padLen = ((length - str.length) / 2) + str.length;
  return str.padStart(Math.ceil(padLen), padStr).padEnd(length, padStr);
};

/**
 * createWordWrap() creates a soft or hard word-wrapping function
 * matching the behavior of the `wordwrap` package without external dependencies.
 */
export const createWordWrap = function createWordWrap(start = 0, stop = 80, { mode = 'soft' } = {}) {
  const re = mode === 'hard' ? /\b/ : /(\S+\s+)/;
  const indent = ' '.repeat(start);

  return function wordWrap(text) {
    const chunks = String(text)
      .split(re)
      .reduce((acc, x) => {
        if (mode === 'hard') {
          for (let i = 0; i < x.length; i += stop - start) {
            acc.push(x.slice(i, i + stop - start));
          }
        } else {
          acc.push(x);
        }
        return acc;
      }, []);

    const lines = [indent];
    chunks.forEach((rawChunk) => {
      if (rawChunk === '') return;

      const chunk = rawChunk.replace(/\t/g, '    ');
      const i = lines.length - 1;

      if (lines[i].length + chunk.length > stop) {
        lines[i] = lines[i].replace(/\s+$/, '');
        chunk.split(/\n/).forEach((c) => {
          lines.push(indent + c.replace(/^\s+/, ''));
        });
      } else if (chunk.includes('\n')) {
        const xs = chunk.split(/\n/);
        lines[i] += xs.shift();
        xs.forEach((c) => {
          lines.push(indent + c.replace(/^\s+/, ''));
        });
      } else {
        lines[i] += chunk;
      }
    });

    return lines.join('\n');
  };
};

export const wrap = createWordWrap(0, 80);
export const wrapNote = createWordWrap(4, 76, { mode: 'hard' });

const shouldColor = () => (
  !process.env.NO_COLOR
  && process.env.FORCE_COLOR !== '0'
  && Boolean(process.env.FORCE_COLOR || process.stdout?.isTTY)
);

export const color = {
  bold: (str) => styleText('bold', str),
  underline: (str) => styleText('underline', str),
  red: (str) => styleText('red', str),
  green: (str) => styleText('green', str),
  yellow: (str) => styleText('yellow', str),
  bgBlackBright: (str) => styleText('bgBlackBright', str),
  headerCell: (str) => styleText(['black', 'bgWhite'], str),
  whiteOnXterm: (code, str) => (
    shouldColor() ? `\x1b[48;5;${code}m\x1b[37m${str}\x1b[39m\x1b[49m` : str
  ),
};
