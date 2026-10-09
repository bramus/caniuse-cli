import omelette from 'omelette';
import { caniuse } from './data.js';
import { parseKeywords } from './search.js';

/**
 * firstArgument() provides omelette tab completion results for the first CLI argument
 */
export const firstArgument = ({ reply }) => {
  const dataKeys = Object.keys(caniuse.data);

  const otherKeys = dataKeys.flatMap((item) => {
    const { firefox_id: firefoxId, keywords } = caniuse.data[item];
    const keys = [];

    if (firefoxId && firefoxId.length > 0) {
      keys.push(firefoxId);
    }

    return keys.concat(parseKeywords(keywords));
  });

  reply([...dataKeys, ...otherKeys]);
};

/**
 * initCompletion() initializes omelette shell tab completion
 */
export const initCompletion = function initCompletion() {
  omelette`caniuse ${firstArgument}`.init();
};
