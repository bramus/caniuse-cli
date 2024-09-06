# `@bramus/caniuse-cli`

Command line tool for [“Can I Use …”](https://caniuse.com/) and [MDN Browser Compat Data](https://github.com/mdn/browser-compat-data)

![npm](https://img.shields.io/npm/v/%40bramus%2Fcaniuse-cli)
![npm bundle size](https://img.shields.io/bundlejs/size/%40bramus/caniuse-cli)
![NPM](https://img.shields.io/npm/l/%40bramus/caniuse-cli)

![caniuse-cli screenshot](https://github.com/bramus/caniuse-cli/raw/main/screenshot.png?raw=true)

## Features

* Instant, offline, results powered by [caniuse-db](https://github.com/Fyrd/caniuse) and [`@mdn/browser-compat-data`](https://github.com/mdn/browser-compat-data).
* Collapses versions with the same level of support in the table, just like the [“Can I Use …” website](https://caniuse.com/).
* Shows notes by number.
* Supports tab autocompletion in **zsh**, **bash** and **fish**.

## Installation

```
# npm install -g @bramus/caniuse-cli
```

## Usage

```bash
$ caniuse viewport-units
$ caniuse "viewport units"
$ caniuse @property
```

## Enable Tab Autocompletion

In **zsh**:

```bash
echo '. <(caniuse --completion)' >> ~/.zshrc
```

In **bash**:

```bash
caniuse --completion >> ~/.caniuse.completion.sh
echo 'source ~/.caniuse.completion.sh' >> ~/.bashrc
```

In **fish**:

```bash
echo 'caniuse --completion-fish | source' >> ~/.config/fish/config.fish
```

That's all!

Now you have an autocompletion system. 

## Possible issues

### Missing `bash-completion` package
```
bash: _get_comp_words_by_ref: command not found
bash: __ltrim_colon_completions: command not found
bash: _get_comp_words_by_ref: command not found
bash: __ltrim_colon_completions: command not found
```

Solution: install `bash-completion` package

## License

`@bramus/caniuse-cli` is released under the MIT public license. See the enclosed `LICENSE` for details.

## Acknowledgements

This project is built on the original https://github.com/dsenkus/caniuse-cli/