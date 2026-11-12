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

const LINK_START = '\uE000';
const LINK_END = '\uE001';
const LINK_MARKERS_RE = /[\uE000\uE001]/g;
const CANIUSE_BASE_URL = 'https://caniuse.com/';
const LINK_TOKEN_RE = /(`[^`]+`)|<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|(https?:\/\/[^\s<>"]+)/gi;

let nextHyperlinkId = 1;

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
  blue: (str) => styleText('blue', str),
  yellow: (str) => styleText('yellow', str),
  orange: (str) => (shouldColor() ? `\x1b[38;5;208m${str}\x1b[39m` : str),
  bgBlackBright: (str) => styleText('bgBlackBright', str),
  headerCell: (str) => styleText(['black', 'bgWhite'], str),
  whiteOnXterm: (code, str) => (
    shouldColor() ? `\x1b[48;5;${code}m\x1b[37m${str}\x1b[39m\x1b[49m` : str
  ),
};

const trimBareUrl = (rawUrl) => {
  let url = rawUrl;
  let suffix = '';

  while (url.length > 0) {
    const lastChar = url[url.length - 1];
    if (/[.,;:!?]/.test(lastChar)) {
      suffix = lastChar + suffix;
      url = url.slice(0, -1);
    } else if (lastChar === ')') {
      const openCount = (url.match(/\(/g) || []).length;
      const closeCount = (url.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        suffix = lastChar + suffix;
        url = url.slice(0, -1);
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return { url, suffix };
};

const resolveLinkTarget = (rawUrl, rawLabel) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl, CANIUSE_BASE_URL);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return null;
  }

  const trimmedLabel = rawLabel?.trim();
  const useOrigin = !trimmedLabel || /^https?:\/\//i.test(trimmedLabel);
  return {
    url: parsedUrl.href,
    label: useOrigin ? parsedUrl.origin : rawLabel,
    atomic: useOrigin,
  };
};

const prepareLinks = (text) => {
  const links = [];
  const cleanText = String(text).replace(LINK_MARKERS_RE, '');
  const markedText = cleanText.replace(
    LINK_TOKEN_RE,
    (match, codeSpan, htmlHref, htmlLabel, mdLabel, mdUrl, bareUrl) => {
      if (codeSpan) {
        return match;
      }

      let resolved = null;
      let suffix = '';

      if (htmlHref !== undefined) {
        const normalizedLabel = htmlLabel.replaceAll('<code>', '`').replaceAll('</code>', '`');
        resolved = resolveLinkTarget(htmlHref, normalizedLabel);
      } else if (mdUrl !== undefined) {
        resolved = resolveLinkTarget(mdUrl, mdLabel);
      } else if (bareUrl !== undefined) {
        const trimmed = trimBareUrl(bareUrl);
        resolved = resolveLinkTarget(trimmed.url);
        suffix = trimmed.suffix;
      }

      if (!resolved) {
        return match;
      }

      links.push(resolved);
      const placeholder = resolved.atomic ? 'x'.repeat(resolved.label.length) : resolved.label;
      return `${LINK_START}${placeholder}${LINK_END}${suffix}`;
    }
  );

  return { markedText, links };
};

/**
 * formatHyperlink() wraps a visible label in an OSC 8 terminal hyperlink escape sequence
 */
export const formatHyperlink = function formatHyperlink(url, label, id) {
  if (!shouldColor()) {
    return label;
  }
  const params = id ? `id=${id}` : '';
  return `\x1b]8;${params};${url}\x07${color.underline(label)}\x1b]8;;\x07`;
};

const restoreLinks = (wrappedText, links) => {
  let index = 0;
  return wrappedText.replace(/\uE000([\s\S]*?)\uE001/g, (_, inner) => {
    const link = links[index++];
    if (!link) {
      return inner;
    }

    const parts = inner.split(/(\r?\n *)/);
    const nonEmptyCount = parts.filter((part, idx) => idx % 2 === 0 && part.length > 0).length;
    const linkId = nonEmptyCount > 1 ? `caniuse-${nextHyperlinkId++}` : undefined;

    let atomicOffset = 0;
    return parts
      .map((part, idx) => {
        if (idx % 2 === 1 || part.length === 0) {
          return part;
        }
        const visibleText = link.atomic
          ? link.label.slice(atomicOffset, atomicOffset + part.length)
          : part;
        atomicOffset += part.length;
        return formatHyperlink(link.url, visibleText, linkId);
      })
      .join('');
  });
};

/**
 * createWordWrap() creates a soft or hard word-wrapping function
 * matching the behavior of the `wordwrap` package without external dependencies.
 */
export const createWordWrap = function createWordWrap(
  start = 0,
  stop = 80,
  { mode = 'soft', linkify = false } = {}
) {
  const re = mode === 'hard' ? /\b/ : /(\S+\s+)/;
  const indent = ' '.repeat(start);
  const visibleLength = (str) => str.replace(LINK_MARKERS_RE, '').length;

  return function wordWrap(text) {
    const useLinks = linkify && shouldColor();
    const { markedText, links } = useLinks
      ? prepareLinks(text)
      : { markedText: String(text), links: [] };

    const chunks = markedText
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

      if (visibleLength(lines[i]) + visibleLength(chunk) > stop) {
        lines[i] = lines[i].replace(/\s+([\uE000\uE001]*)$/, '$1');
        chunk.split(/\n/).forEach((c) => {
          lines.push(indent + c.replace(/^([\uE000\uE001]*)\s+/, '$1'));
        });
      } else if (chunk.includes('\n')) {
        const xs = chunk.split(/\n/);
        lines[i] += xs.shift();
        xs.forEach((c) => {
          lines.push(indent + c.replace(/^([\uE000\uE001]*)\s+/, '$1'));
        });
      } else {
        lines[i] += chunk;
      }
    });

    const wrapped = lines.join('\n');
    return links.length > 0 ? restoreLinks(wrapped, links) : wrapped;
  };
};

export const wrap = createWordWrap(0, 80, { linkify: true });
export const wrapNote = createWordWrap(4, 76, { mode: 'hard', linkify: true });
